// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";

import {ClaspFactory} from "../../src/ClaspFactory.sol";
import {ClaspVault} from "../../src/ClaspVault.sol";
import {Position} from "../../src/interfaces/IClaspVault.sol";
import {PonsLaunchedToken, PonsGraduationPhase} from "../../src/interfaces/IPons.sol";
import {MockPonsFactory, MockToken, MockEscrow} from "../mocks/PonsMocks.sol";
import {RevertingReceiver, defaultTerms} from "../utils/Base.sol";

/// @dev Random churn across 7 actors (6 EOAs + 1 contract whose `receive` can revert).
/// Every entry point guards its own preconditions so no call reverts (fail_on_revert).
contract VaultHandler is Test {
    ClaspVault public immutable vault;
    MockToken public immutable token;
    MockEscrow public immutable escrow;
    RevertingReceiver public immutable receiver;
    address[] public actors;
    uint256[] public ids;

    mapping(string => uint256) public calls;

    constructor(ClaspVault vault_, MockToken token_, MockEscrow escrow_) {
        vault = vault_;
        token = token_;
        escrow = escrow_;
        receiver = new RevertingReceiver();
        for (uint256 i; i < 6; ++i) {
            actors.push(makeAddr(string(abi.encodePacked("actor", vm.toString(i)))));
        }
        actors.push(address(receiver));
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function idCount() external view returns (uint256) {
        return ids.length;
    }

    // ------------------------------------------------------------------ actions

    function lock(uint256 actorSeed, uint256 amount, uint256 secs, bool forOther) external {
        address actor = actors[actorSeed % actors.length];
        address owner = forOther ? actors[(actorSeed / 7) % actors.length] : actor;
        amount = bound(amount, 1e18, 20_000_000e18);
        secs = bound(secs, 4 hours, 365 days);
        token.mint(actor, amount);
        vm.startPrank(actor);
        token.approve(address(vault), amount);
        uint256 id = forOther ? vault.lockFor(owner, amount, secs) : vault.lock(amount, secs);
        vm.stopPrank();
        ids.push(id);
        calls["lock"]++;
    }

    function increase(uint256 idSeed, uint256 amount) external {
        (bool ok, uint256 id, Position memory p) = _pick(idSeed);
        if (!ok || vm.getBlockTimestamp() + 4 hours > p.lockEnd) return;
        amount = bound(amount, 1, 10_000_000e18);
        token.mint(p.owner, amount);
        vm.startPrank(p.owner);
        token.approve(address(vault), amount);
        vault.increase(id, amount);
        vm.stopPrank();
        calls["increase"]++;
    }

    function extend(uint256 idSeed, uint256 secs) external {
        (bool ok, uint256 id, Position memory p) = _pick(idSeed);
        if (!ok) return;
        secs = bound(secs, 4 hours, 365 days);
        if (vm.getBlockTimestamp() + secs <= p.lockEnd) return;
        vm.prank(p.owner);
        vault.extend(id, secs);
        calls["extend"]++;
    }

    function claim(uint256 idSeed) external {
        (bool ok, uint256 id, Position memory p) = _pick(idSeed);
        if (!ok) return;
        vm.prank(p.owner);
        vault.claim(id);
        calls["claim"]++;
    }

    function claimAll(uint256 actorSeed) external {
        address actor = actors[actorSeed % actors.length];
        uint256[] memory mine = vault.positionsOf(actor);
        vm.prank(actor);
        vault.claimAll(mine);
        calls["claimAll"]++;
    }

    function unlock(uint256 idSeed, uint256 callerSeed) external {
        (bool ok, uint256 id, Position memory p) = _pick(idSeed);
        if (!ok || vm.getBlockTimestamp() < p.lockEnd) return;
        vm.prank(actors[callerSeed % actors.length]);
        vault.unlock(id);
        calls["unlock"]++;
    }

    function earlyUnlock(uint256 idSeed) external {
        (bool ok, uint256 id, Position memory p) = _pick(idSeed);
        if (!ok || vm.getBlockTimestamp() >= p.lockEnd) return;
        vm.prank(p.owner);
        vault.earlyUnlock(id);
        calls["earlyUnlock"]++;
    }

    /// @dev Router-style arrival: plain transfer, optionally synced in the same tx.
    function feeArrival(uint256 amount, bool syncNow) external {
        amount = bound(amount, 1, 50 ether);
        vm.deal(address(this), amount);
        (bool ok,) = address(vault).call{value: amount}("");
        require(ok, "send");
        if (syncNow) vault.sync();
        calls["feeArrival"]++;
    }

    /// @dev Pons creator fees credited to the vault in the escrow, pulled by harvest.
    function escrowArrival(uint256 amount) external {
        amount = bound(amount, 1, 50 ether);
        vm.deal(address(this), amount);
        escrow.credit{value: amount}(address(vault));
        vault.harvest();
        calls["escrowArrival"]++;
    }

    function warp(uint256 secs) external {
        secs = bound(secs, 1, 20 days);
        vm.warp(vm.getBlockTimestamp() + secs);
        calls["warp"]++;
    }

    function claimTreasury() external {
        vault.claimTreasury();
        calls["claimTreasury"]++;
    }

    function withdrawOwed(uint256 actorSeed) external {
        address actor = actors[actorSeed % actors.length];
        if (vault.owed(actor) == 0) return;
        address to = actor == address(receiver) ? makeAddr("rescue") : actor;
        vm.prank(actor);
        vault.withdrawOwed(to);
        calls["withdrawOwed"]++;
    }

    function toggleReceiver() external {
        receiver.setAccept(!receiver.accept());
        calls["toggleReceiver"]++;
    }

    // ------------------------------------------------------------------ helpers

    function _pick(uint256 seed) internal view returns (bool ok, uint256 id, Position memory p) {
        if (ids.length == 0) return (false, 0, p);
        id = ids[seed % ids.length];
        p = vault.position(id);
        ok = p.amount != 0;
    }

    receive() external payable {}
}

contract VaultInvariantTest is Test {
    ClaspVault internal vault;
    MockToken internal token;
    VaultHandler internal handler;
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        vm.warp(1_750_000_000);
        MockPonsFactory pons = new MockPonsFactory();
        token = new MockToken("Coin", "COIN");
        token.mint(address(0xB0B), 1_000_000_000e18); // realistic supply for the size tiers
        pons.setLaunched(
            address(token),
            PonsLaunchedToken({
                token: address(token),
                curve: address(0),
                deployer: address(this),
                creatorFeeRecipient: address(this),
                pairToken: address(0),
                graduationThreshold: 4.2 ether,
                poolFee: 0,
                tickSpacing: 200,
                creatorTaxBps: 0,
                buybackEnabled: false,
                phase: PonsGraduationPhase.PoolCreated,
                sweptQuote: 0,
                sweptTokens: 0,
                sweptAt: 0,
                exists: true
            })
        );
        ClaspFactory factory = new ClaspFactory(address(this), treasury, address(pons), defaultTerms());
        vault = ClaspVault(payable(factory.createVault(address(token), bytes32(0))));
        pons.transferCreatorFeeRecipient(address(token), address(vault));
        handler = new VaultHandler(vault, token, pons.escrow());
        targetContract(address(handler));
    }

    /// @dev The vault can always pay everything it owes.
    function invariant_solvent() public view {
        uint256 owedToLockers;
        uint256 n = handler.idCount();
        for (uint256 i; i < n; ++i) {
            owedToLockers += vault.pending(handler.ids(i));
        }
        uint256 liabilities = owedToLockers + vault.undistributed() + vault.treasuryOwed() + vault.totalOwed();
        assertLe(liabilities, address(vault).balance, "sum(pending) + undistributed + treasuryOwed + owed <= balance");
    }

    /// @dev totalWeight / totalLocked equal the sums over open positions, and the vault
    /// holds exactly the locked tokens.
    function invariant_totalsMatchPositions() public view {
        uint256 w;
        uint256 a;
        uint256 open;
        uint256 n = handler.idCount();
        for (uint256 i; i < n; ++i) {
            Position memory p = vault.position(handler.ids(i));
            w += p.weight;
            a += p.amount;
            if (p.amount != 0) open++;
        }
        assertEq(vault.totalWeight(), w, "totalWeight == sum of position weights");
        assertEq(vault.totalLocked(), a, "totalLocked == sum of position amounts");
        assertEq(token.balanceOf(address(vault)), a, "vault holds exactly the locked tokens");

        uint256 listed;
        uint256 owedSum;
        uint256 actors = handler.actorCount();
        for (uint256 i; i < actors; ++i) {
            address actor = handler.actors(i);
            listed += vault.positionsOf(actor).length;
            owedSum += vault.owed(actor);
        }
        assertEq(listed, open, "positionsOf lists every open position exactly once");
        assertEq(vault.totalOwed(), owedSum + vault.owed(treasury), "totalOwed == sum of owed");
    }

    /// @dev Nothing is created or lost: every wei that was synced in is either still in
    /// the vault or was paid out (the vault only pays via recorded outflows).
    function invariant_noUnrecordedOutflow() public {
        vault.sync(); // reverts on an unrecorded balance drop
    }

    function afterInvariant() external view {
        // show the action mix so a degenerate run is visible in -vv output
        string[13] memory names = [
            "lock", "increase", "extend", "claim", "claimAll", "unlock", "earlyUnlock", "feeArrival",
            "escrowArrival", "warp", "claimTreasury", "withdrawOwed", "toggleReceiver"
        ];
        for (uint256 i; i < names.length; ++i) {
            console2.log(names[i], handler.calls(names[i]));
        }
    }
}
