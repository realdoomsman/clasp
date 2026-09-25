// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Base, defaultTerms} from "./utils/Base.sol";
import {ClaspFactory} from "../src/ClaspFactory.sol";
import {ClaspVault} from "../src/ClaspVault.sol";
import {IClaspFactory} from "../src/interfaces/IClaspFactory.sol";
import {Terms} from "../src/libraries/ClaspMath.sol";
import {MockToken} from "./mocks/PonsMocks.sol";

contract ClaspFactoryTest is Base {
    function test_constructor() public view {
        assertEq(factory.owner(), owner);
        assertEq(factory.treasury(), treasury);
        assertEq(factory.ponsFactory(), address(pons));
        assertEq(factory.feeEscrow(), address(escrow));
        assertEq(factory.memeHook(), address(hook));
        assertEq(abi.encode(factory.defaults()), abi.encode(defaultTerms()));
        assertFalse(factory.paused());
        assertEq(factory.vaultCount(), 1);
        assertEq(factory.allVaults(0), address(vault));
        assertEq(factory.vaultOf(address(token)), address(vault));
    }

    function test_constructor_reverts() public {
        vm.expectRevert(IClaspFactory.ZeroAddress.selector);
        new ClaspFactory(owner, treasury, address(0), defaultTerms());
        vm.expectRevert(IClaspFactory.ZeroAddress.selector);
        new ClaspFactory(owner, address(0), address(pons), defaultTerms());
        Terms memory t = defaultTerms();
        t.streamSecs = 0;
        vm.expectRevert(IClaspFactory.InvalidTerms.selector);
        new ClaspFactory(owner, treasury, address(pons), t);
    }

    function test_createVault() public {
        MockToken t = new MockToken("T", "T");
        _register(address(t), creator, address(0), false);
        address predicted = factory.predictVault(address(t));
        assertEq(predicted.code.length, 0);

        vm.expectEmit(address(factory));
        emit IClaspFactory.VaultCreated(address(t), predicted, alice, defaultTerms());
        vm.prank(alice);
        address v = factory.createVault(address(t), bytes32(0));

        assertEq(v, predicted, "CREATE2 address known in advance");
        assertEq(factory.vaultOf(address(t)), v);
        assertEq(factory.vaultCount(), 2);
        assertEq(factory.allVaults(1), v);
        assertEq(ClaspVault(payable(v)).token(), address(t));
        assertFalse(ClaspVault(payable(v)).isFeeRecipient(), "recipient can be transferred later");
        (address pt, address ptr,) = factory.vaultParams();
        assertEq(pt, address(0), "params cleared");
        assertEq(ptr, address(0));
    }

    function test_createVault_reverts() public {
        vm.expectRevert(IClaspFactory.VaultExists.selector);
        factory.createVault(address(token), bytes32(0));

        MockToken notPons = new MockToken("X", "X");
        vm.expectRevert(IClaspFactory.NotPonsLaunch.selector);
        factory.createVault(address(notPons), bytes32(0));

        MockToken usdPaired = new MockToken("U", "U");
        _register(address(usdPaired), creator, address(0xBEEF), false);
        vm.expectRevert(IClaspFactory.NotEthPaired.selector);
        factory.createVault(address(usdPaired), bytes32(0));

        MockToken buyback = new MockToken("B", "B");
        _register(address(buyback), creator, address(0), true);
        vm.expectRevert(IClaspFactory.BuybackEnabled.selector);
        factory.createVault(address(buyback), bytes32(0));

        MockToken t = new MockToken("T", "T");
        _register(address(t), creator, address(0), false);
        vm.prank(owner);
        factory.setPaused(true);
        vm.expectRevert(IClaspFactory.IsPaused.selector);
        factory.createVault(address(t), bytes32(0));
        vm.prank(owner);
        factory.setPaused(false);
        factory.createVault(address(t), bytes32(0));
    }

    function test_createVault_termsPin() public {
        bytes32 h = factory.defaultsHash();
        assertEq(h, keccak256(abi.encode(defaultTerms())));
        assertEq(h, keccak256(abi.encode(vault.terms())), "hash of a vault's terms() matches");

        MockToken t = new MockToken("T", "T");
        _register(address(t), creator, address(0), false);
        vm.expectRevert(IClaspFactory.TermsMismatch.selector);
        factory.createVault(address(t), bytes32(uint256(1)));

        // owner changes the defaults after the caller read them: the pinned call reverts
        Terms memory changed = defaultTerms();
        changed.lockerShareBps = 8000;
        vm.prank(owner);
        factory.setDefaults(changed);
        vm.expectRevert(IClaspFactory.TermsMismatch.selector);
        factory.createVault(address(t), h);

        address v = factory.createVault(address(t), factory.defaultsHash());
        assertEq(keccak256(abi.encode(ClaspVault(payable(v)).terms())), keccak256(abi.encode(changed)));
    }

    function test_setDefaults_onlyAffectsFutureVaults() public {
        Terms memory t = defaultTerms();
        t.lockerShareBps = 8000;
        t.penaltyBps = 5000;
        vm.expectEmit(address(factory));
        emit IClaspFactory.DefaultsUpdated(t);
        vm.prank(owner);
        factory.setDefaults(t);
        assertEq(vault.terms().lockerShareBps, 9000, "existing vault frozen");

        MockToken t2 = new MockToken("T2", "T2");
        _register(address(t2), creator, address(0), false);
        ClaspVault v2 = ClaspVault(payable(factory.createVault(address(t2), bytes32(0))));
        assertEq(v2.terms().lockerShareBps, 8000);
        assertEq(v2.terms().penaltyBps, 5000);
    }

    function test_setDefaults_validation() public {
        Terms[] memory bad = new Terms[](16);
        for (uint256 i; i < bad.length; ++i) bad[i] = defaultTerms();
        bad[0].minLockSecs = 0;
        bad[1].maxLockSecs = bad[1].minLockSecs;
        bad[2].maxLockSecs = uint32(5 * 365 days + 1);
        bad[3].streamSecs = uint32(7 days + 1);
        bad[4].lockerShareBps = 7999; // treasury > 20%
        bad[5].lockerShareBps = 10_001;
        bad[6].penaltyBps = 5001;
        bad[7].minPenaltyBps = bad[7].penaltyBps + 1;
        bad[8].tier1ShareBps = 0;
        bad[9].tier2ShareBps = bad[9].tier1ShareBps - 1;
        bad[10].tier3BonusBps = 10_001;
        bad[11].minLockAmount = 0;
        bad[12].minLockAmount = 1_000e18 + 1; // could exceed what anyone holds -> 100% to treasury
        bad[13].minLockAmount = type(uint128).max;
        bad[14].minLockSecs = uint32(7 days + 1);
        bad[14].streamSecs = uint32(1 hours);
        bad[15].streamSecs = bad[15].minLockSecs + 1; // stream longer than the shortest lock
        vm.startPrank(owner);
        for (uint256 i; i < bad.length; ++i) {
            vm.expectRevert(IClaspFactory.InvalidTerms.selector);
            factory.setDefaults(bad[i]);
        }
        Terms memory edge = defaultTerms();
        edge.lockerShareBps = 8000;
        edge.penaltyBps = 5000;
        edge.minPenaltyBps = 5000;
        edge.maxLockSecs = uint32(5 * 365 days);
        edge.minLockSecs = uint32(7 days);
        edge.streamSecs = uint32(7 days);
        edge.minLockAmount = 1_000e18;
        factory.setDefaults(edge);
        vm.stopPrank();
    }

    function test_setTreasury() public {
        vm.expectEmit(address(factory));
        emit IClaspFactory.TreasuryUpdated(alice);
        vm.prank(owner);
        factory.setTreasury(alice);
        assertEq(factory.treasury(), alice);
        assertEq(vault.treasury(), treasury, "existing vault keeps its treasury");
        vm.prank(owner);
        vm.expectRevert(IClaspFactory.ZeroAddress.selector);
        factory.setTreasury(address(0));
    }

    function test_setPaused_event() public {
        vm.expectEmit(address(factory));
        emit IClaspFactory.Paused(true);
        vm.prank(owner);
        factory.setPaused(true);
        assertTrue(factory.paused());
        // pausing never touches existing vaults
        _lock(alice, 10e18, 4 hours);
    }

    function test_onlyOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.setDefaults(defaultTerms());
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.setTreasury(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.setPaused(true);
        vm.stopPrank();
    }

    function test_ownable2Step() public {
        vm.prank(owner);
        factory.transferOwnership(alice);
        assertEq(factory.owner(), owner, "not until accepted");
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        factory.acceptOwnership();
        vm.prank(alice);
        factory.acceptOwnership();
        assertEq(factory.owner(), alice);
    }
}
