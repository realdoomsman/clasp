// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IClaspVault, Position} from "./interfaces/IClaspVault.sol";
import {IClaspFactory} from "./interfaces/IClaspFactory.sol";
import {
    IPonsV2LaunchFactory,
    IPonsV2FeeEscrow,
    IPonsV2BondingCurve,
    IPonsV2MemeHook,
    PonsLaunchedToken,
    PonsGraduationPhase
} from "./interfaces/IPons.sol";
import {ClaspMath, Terms} from "./libraries/ClaspMath.sol";

/// @title ClaspVault
/// @notice One vault per coin. Holders lock the coin and earn the ETH that arrives here
/// (Pons creator fees + the Clasp router fee), weighted by amount x lock duration.
///
/// ETH accounting is by balance difference: any ETH that lands is inflow, split
/// `lockerShareBps` to lockers (streamed linearly over `streamSecs`) and the rest to
/// the treasury. Only this contract moves ETH out and every outflow is recorded, so an
/// unrecorded balance drop reverts. Liabilities (released-but-unclaimed rewards +
/// `undistributed` + `treasuryOwed` + `totalOwed`) never exceed the balance.
///
/// Immutable: no owner, no upgrade path, no admin access to tokens or ETH.
contract ClaspVault is IClaspVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Early-exit penalties are sent here.
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 internal constant ACC_SCALE = 1e18;
    uint256 internal constant BPS = 10_000;

    address public immutable factory;
    address public immutable token;
    address public immutable treasury;
    address public immutable ponsFactory;
    address public immutable feeEscrow;
    address public immutable memeHook;

    uint32 internal immutable _minLockSecs;
    uint32 internal immutable _maxLockSecs;
    uint32 internal immutable _streamSecs;
    uint16 internal immutable _lockerShareBps;
    uint16 internal immutable _penaltyBps;
    uint16 internal immutable _minPenaltyBps;
    uint16 internal immutable _tier1ShareBps;
    uint16 internal immutable _tier1BonusBps;
    uint16 internal immutable _tier2ShareBps;
    uint16 internal immutable _tier2BonusBps;
    uint16 internal immutable _tier3ShareBps;
    uint16 internal immutable _tier3BonusBps;
    uint128 internal immutable _minLockAmount;

    /// @notice Sum of open positions' weights.
    uint256 public totalWeight;
    /// @notice Sum of open positions' token amounts.
    uint256 public totalLocked;
    /// @notice Sum of `owed[]`.
    uint256 public totalOwed;
    /// @notice All ETH ever detected as inflow.
    uint256 public lifetimeInflow;
    /// @notice All ETH ever paid (or credited to `owed`) to lockers as claimed rewards.
    uint256 public lifetimeRewards;
    /// @notice ETH whose payout reverted, withdrawable by the recipient via `withdrawOwed`.
    mapping(address => uint256) public owed;

    uint256 internal _acc;
    /// @dev Remainder of the last `released * 1e18 / totalWeight` division, carried into
    /// the next release so rounding never loses lockers' ETH (only defers < 1 wei).
    uint256 internal _accCarry;
    uint256 internal _undistributed;
    uint256 internal _treasuryOwed;
    uint64 internal _streamEnd;
    uint64 internal _lastRelease;
    uint256 internal _recordedBalance;

    uint256 internal _lastId;
    mapping(uint256 => Position) internal _positions;
    mapping(address => uint256[]) internal _ownerIds;
    mapping(uint256 => uint256) internal _ownerIndex;

    error InvalidOwner();

    struct Release {
        uint256 acc;
        uint256 carry;
        uint256 undistributed;
        uint256 treasuryOwed;
    }

    constructor() {
        factory = msg.sender;
        (address token_, address treasury_, Terms memory t) = IClaspFactory(msg.sender).vaultParams();
        if (token_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        token = token_;
        treasury = treasury_;
        ponsFactory = IClaspFactory(msg.sender).ponsFactory();
        feeEscrow = IClaspFactory(msg.sender).feeEscrow();
        memeHook = IClaspFactory(msg.sender).memeHook();

        _minLockSecs = t.minLockSecs;
        _maxLockSecs = t.maxLockSecs;
        _streamSecs = t.streamSecs;
        _lockerShareBps = t.lockerShareBps;
        _penaltyBps = t.penaltyBps;
        _minPenaltyBps = t.minPenaltyBps;
        _tier1ShareBps = t.tier1ShareBps;
        _tier1BonusBps = t.tier1BonusBps;
        _tier2ShareBps = t.tier2ShareBps;
        _tier2BonusBps = t.tier2BonusBps;
        _tier3ShareBps = t.tier3ShareBps;
        _tier3BonusBps = t.tier3BonusBps;
        _minLockAmount = t.minLockAmount;
        _lastRelease = uint64(block.timestamp);
    }

    /// @notice Accepts ETH from anyone (router fee, escrow claim, plain transfer). It is
    /// counted as inflow at the next `sync`.
    receive() external payable {}

    // =============================================================== locking

    /// @inheritdoc IClaspVault
    function lock(uint256 amount, uint256 durationSecs) external nonReentrant returns (uint256 id) {
        id = _lock(msg.sender, msg.sender, amount, durationSecs);
    }

    /// @inheritdoc IClaspVault
    function lockFor(address owner, uint256 amount, uint256 durationSecs) external nonReentrant returns (uint256 id) {
        id = _lock(msg.sender, owner, amount, durationSecs);
    }

    /// @inheritdoc IClaspVault
    function increase(uint256 id, uint256 amount) external nonReentrant {
        Position storage p = _owned(id);
        if (block.timestamp >= p.lockEnd) revert AlreadyMatured();
        // Added tokens must stay locked at least as long as a fresh lock would.
        if (p.lockEnd - block.timestamp < _minLockSecs) revert InvalidDuration();
        _sync();
        uint256 received = _pull(msg.sender, amount);
        if (received == 0) revert AmountTooSmall();

        uint256 remaining = p.lockEnd - block.timestamp;
        uint256 newAmount = p.amount + received;
        uint256 newTerm = ClaspMath.blendedTerm(p.amount, received, p.lockEnd - p.lockStart, remaining);
        (uint256 mult, uint256 w) = _price(newAmount, remaining);

        _reweigh(p, w);
        totalLocked += received;
        p.amount = newAmount;
        p.multiplierBps = uint32(mult);
        p.lockStart = uint48(p.lockEnd - newTerm);
        emit Increased(id, received, w, p.lockStart);
    }

    /// @inheritdoc IClaspVault
    function extend(uint256 id, uint256 durationSecs) external nonReentrant {
        Position storage p = _owned(id);
        _checkDuration(durationSecs);
        uint256 newEnd = block.timestamp + durationSecs;
        if (newEnd <= p.lockEnd) revert ExtendMustIncreaseEnd();
        _sync();
        (uint256 mult, uint256 w) = _price(p.amount, durationSecs);

        _reweigh(p, w);
        p.multiplierBps = uint32(mult);
        p.lockStart = uint48(block.timestamp);
        p.lockEnd = uint48(newEnd);
        emit Extended(id, newEnd, mult, w);
    }

    // =============================================================== rewards

    /// @inheritdoc IClaspVault
    function claim(uint256 id) external nonReentrant returns (uint256 amount) {
        Position storage p = _owned(id);
        _sync();
        amount = _settle(p);
        if (amount != 0) {
            _recordClaim(id, p, amount);
            _payETH(msg.sender, amount);
        }
    }

    /// @inheritdoc IClaspVault
    function claimAll(uint256[] calldata ids) external nonReentrant returns (uint256 amount) {
        _sync();
        for (uint256 i; i < ids.length; ++i) {
            Position storage p = _owned(ids[i]);
            uint256 a = _settle(p);
            if (a != 0) {
                _recordClaim(ids[i], p, a);
                amount += a;
            }
        }
        if (amount != 0) _payETH(msg.sender, amount);
    }

    /// @inheritdoc IClaspVault
    function unlock(uint256 id) external nonReentrant {
        Position storage p = _open(id);
        if (block.timestamp < p.lockEnd) revert NotMatured();
        _sync();
        address owner = p.owner;
        uint256 amount = p.amount;
        uint256 reward = _settle(p);
        if (reward != 0) _recordClaim(id, p, reward);
        _close(id, p);

        IERC20(token).safeTransfer(owner, amount);
        if (reward != 0) _payETH(owner, reward);
        emit Unlocked(id, owner, amount, 0, 0, false);
    }

    /// @inheritdoc IClaspVault
    function earlyUnlock(uint256 id) external nonReentrant {
        Position storage p = _owned(id);
        if (block.timestamp >= p.lockEnd) revert AlreadyMatured();
        _sync();
        uint256 amount = p.amount;
        uint256 burn = ClaspMath.earlyExitBurn(
            amount, p.lockEnd - block.timestamp, p.lockEnd - p.lockStart, _penaltyBps, _minPenaltyBps
        );
        uint256 forfeited = _settle(p);
        _close(id, p);
        // Forfeited rewards were already released to lockers; they go back into the
        // stream (not instantly) for the remaining weight.
        _stream(forfeited);

        if (burn != 0) IERC20(token).safeTransfer(DEAD, burn);
        if (amount > burn) IERC20(token).safeTransfer(msg.sender, amount - burn);
        emit Unlocked(id, msg.sender, amount - burn, burn, forfeited, true);
    }

    /// @inheritdoc IClaspVault
    function harvest() external nonReentrant returns (uint256 arrived) {
        arrived = _sync();
        _pullPonsFees();
        arrived += _sync();
    }

    /// @inheritdoc IClaspVault
    function sync() external nonReentrant returns (uint256 arrived) {
        arrived = _sync();
    }

    /// @inheritdoc IClaspVault
    function claimTreasury() external nonReentrant returns (uint256 amount) {
        _sync();
        amount = _treasuryOwed;
        if (amount == 0) return 0;
        _treasuryOwed = 0;
        emit TreasuryClaimed(amount);
        _payETH(treasury, amount);
    }

    /// @inheritdoc IClaspVault
    function withdrawOwed(address to) external nonReentrant returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        _sync();
        amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();
        owed[msg.sender] = 0;
        totalOwed -= amount;
        _recordedBalance -= amount;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit OwedWithdrawn(msg.sender, to, amount);
    }

    // =============================================================== views

    /// @inheritdoc IClaspVault
    function terms() public view returns (Terms memory t) {
        t = Terms({
            minLockSecs: _minLockSecs,
            maxLockSecs: _maxLockSecs,
            streamSecs: _streamSecs,
            lockerShareBps: _lockerShareBps,
            penaltyBps: _penaltyBps,
            minPenaltyBps: _minPenaltyBps,
            tier1ShareBps: _tier1ShareBps,
            tier1BonusBps: _tier1BonusBps,
            tier2ShareBps: _tier2ShareBps,
            tier2BonusBps: _tier2BonusBps,
            tier3ShareBps: _tier3ShareBps,
            tier3BonusBps: _tier3BonusBps,
            minLockAmount: _minLockAmount
        });
    }

    /// @inheritdoc IClaspVault
    function pending(uint256 id) external view returns (uint256) {
        Position storage p = _positions[id];
        if (p.amount == 0) return 0;
        uint256 acc = _previewRelease().acc;
        return (p.rewardCredit + p.weight * acc - p.rewardDebt) / ACC_SCALE;
    }

    /// @inheritdoc IClaspVault
    function position(uint256 id) external view returns (Position memory) {
        return _positions[id];
    }

    /// @inheritdoc IClaspVault
    function positionsOf(address owner) external view returns (uint256[] memory) {
        return _ownerIds[owner];
    }

    /// @inheritdoc IClaspVault
    function positionCount() external view returns (uint256) {
        return _lastId;
    }

    /// @inheritdoc IClaspVault
    function undistributed() external view returns (uint256 u) {
        u = _previewRelease().undistributed;
    }

    /// @inheritdoc IClaspVault
    function streamEnd() external view returns (uint256) {
        return _streamEnd;
    }

    /// @inheritdoc IClaspVault
    function accRewardPerWeight() external view returns (uint256 acc) {
        acc = _previewRelease().acc;
    }

    /// @inheritdoc IClaspVault
    function treasuryOwed() external view returns (uint256 t) {
        t = _previewRelease().treasuryOwed;
    }

    /// @inheritdoc IClaspVault
    function isFeeRecipient() external view returns (bool) {
        return IPonsV2LaunchFactory(ponsFactory).getLaunchedToken(token).creatorFeeRecipient == address(this);
    }

    /// @inheritdoc IClaspVault
    function previewMultiplier(uint256 amount, uint256 durationSecs)
        external
        view
        returns (uint256 multiplierBps, uint256 weight)
    {
        return _price(amount, durationSecs);
    }

    /// @inheritdoc IClaspVault
    function previewIncrease(uint256 id, uint256 amount)
        external
        view
        returns (uint256 multiplierBps, uint256 weight, uint256 lockStart)
    {
        Position storage p = _open(id);
        if (block.timestamp >= p.lockEnd) revert AlreadyMatured();
        uint256 remaining = p.lockEnd - block.timestamp;
        if (remaining < _minLockSecs) revert InvalidDuration();
        (multiplierBps, weight) = _price(p.amount + amount, remaining);
        lockStart = p.lockEnd - ClaspMath.blendedTerm(p.amount, amount, p.lockEnd - p.lockStart, remaining);
    }

    /// @inheritdoc IClaspVault
    function previewEarlyUnlock(uint256 id) external view returns (uint256 burn, uint256 returned, uint256 forfeited) {
        Position storage p = _open(id);
        if (block.timestamp >= p.lockEnd) return (0, p.amount, 0);
        burn = ClaspMath.earlyExitBurn(
            p.amount, p.lockEnd - block.timestamp, p.lockEnd - p.lockStart, _penaltyBps, _minPenaltyBps
        );
        returned = p.amount - burn;
        uint256 acc = _previewRelease().acc;
        forfeited = (p.rewardCredit + p.weight * acc - p.rewardDebt) / ACC_SCALE;
    }

    // =============================================================== internals: positions

    function _lock(address payer, address owner, uint256 amount, uint256 durationSecs) internal returns (uint256 id) {
        if (owner == address(0) || owner == address(this)) revert InvalidOwner();
        _checkDuration(durationSecs);
        _sync();
        uint256 received = _pull(payer, amount);
        if (received < _minLockAmount) revert AmountTooSmall();
        (uint256 mult, uint256 w) = _price(received, durationSecs);

        id = ++_lastId;
        Position storage p = _positions[id];
        p.owner = owner;
        p.lockStart = uint48(block.timestamp);
        p.lockEnd = uint48(block.timestamp + durationSecs);
        p.multiplierBps = uint32(mult);
        p.amount = received;
        p.weight = w;
        p.rewardDebt = w * _acc;
        totalWeight += w;
        totalLocked += received;

        _ownerIndex[id] = _ownerIds[owner].length;
        _ownerIds[owner].push(id);
        emit Locked(id, owner, received, durationSecs, mult, w, p.lockEnd);
    }

    /// @dev Moves the accrued-but-unclaimed rewards into `rewardCredit` and applies a new weight.
    function _reweigh(Position storage p, uint256 newWeight) internal {
        uint256 acc = _acc;
        p.rewardCredit += p.weight * acc - p.rewardDebt;
        totalWeight = totalWeight - p.weight + newWeight;
        p.weight = newWeight;
        p.rewardDebt = newWeight * acc;
    }

    /// @dev Checkpoints the position and returns its whole-wei rewards; the sub-wei
    /// residue stays in `rewardCredit`.
    function _settle(Position storage p) internal returns (uint256 amount) {
        uint256 acc = _acc;
        uint256 scaled = p.rewardCredit + p.weight * acc - p.rewardDebt;
        amount = scaled / ACC_SCALE;
        p.rewardCredit = scaled - amount * ACC_SCALE;
        p.rewardDebt = p.weight * acc;
    }

    function _recordClaim(uint256 id, Position storage p, uint256 amount) internal {
        p.claimed += amount;
        lifetimeRewards += amount;
        emit Claimed(id, p.owner, amount);
    }

    /// @dev Removes an open position. Keeps owner/lockStart/lockEnd/claimed for history.
    function _close(uint256 id, Position storage p) internal {
        totalWeight -= p.weight;
        totalLocked -= p.amount;
        p.amount = 0;
        p.weight = 0;
        p.rewardDebt = 0;
        p.rewardCredit = 0;

        uint256[] storage ids = _ownerIds[p.owner];
        uint256 idx = _ownerIndex[id];
        uint256 lastId = ids[ids.length - 1];
        ids[idx] = lastId;
        _ownerIndex[lastId] = idx;
        ids.pop();
        delete _ownerIndex[id];
    }

    function _price(uint256 amount, uint256 durationSecs) internal view returns (uint256 mult, uint256 w) {
        uint256 dur = ClaspMath.durationBps(durationSecs, _minLockSecs, _maxLockSecs);
        uint256 bonus = ClaspMath.sizeBonusBps(amount, IERC20(token).totalSupply(), terms());
        mult = ClaspMath.multiplierBps(dur, bonus);
        w = ClaspMath.weight(amount, dur, bonus);
    }

    function _pull(address from, uint256 amount) internal returns (uint256 received) {
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        received = IERC20(token).balanceOf(address(this)) - before;
    }

    function _checkDuration(uint256 durationSecs) internal view {
        if (durationSecs < _minLockSecs || durationSecs > _maxLockSecs) revert InvalidDuration();
    }

    function _open(uint256 id) internal view returns (Position storage p) {
        p = _positions[id];
        if (p.amount == 0) revert UnknownPosition();
    }

    function _owned(uint256 id) internal view returns (Position storage p) {
        p = _open(id);
        if (p.owner != msg.sender) revert NotOwner();
    }

    // =============================================================== internals: ETH

    /// @dev Releases the stream up to now, then books any unrecorded balance increase
    /// as inflow. Reverts if the balance fell below what was recorded.
    function _sync() internal returns (uint256 arrived) {
        _release();
        uint256 bal = address(this).balance;
        uint256 recorded = _recordedBalance;
        if (bal < recorded) revert UnrecordedOutflow();
        arrived = bal - recorded;
        if (arrived == 0) return 0;
        _recordedBalance = bal;
        lifetimeInflow += arrived;
        uint256 toLockers = (arrived * _lockerShareBps) / BPS;
        uint256 toTreasury = arrived - toLockers;
        _treasuryOwed += toTreasury;
        _stream(toLockers);
        emit FeesArrived(arrived, toLockers, toTreasury);
    }

    /// @dev Adds `amount` to the stream and restarts its window. Callers have already
    /// released the stream up to now (via `_sync`).
    function _stream(uint256 amount) internal {
        if (amount == 0) return;
        _undistributed += amount;
        _streamEnd = uint64(block.timestamp + _streamSecs);
        _lastRelease = uint64(block.timestamp);
    }

    function _release() internal {
        Release memory r = _previewRelease();
        _acc = r.acc;
        _accCarry = r.carry;
        _undistributed = r.undistributed;
        _treasuryOwed = r.treasuryOwed;
        _lastRelease = uint64(block.timestamp);
    }

    /// @dev Linear release of `_undistributed` from `_lastRelease` to `_streamEnd`. With
    /// no weight, released ETH goes to the treasury. `acc` rounds down (the remainder is
    /// carried), so lockers can never be owed more than was released.
    function _previewRelease() internal view returns (Release memory r) {
        r = Release({acc: _acc, carry: _accCarry, undistributed: _undistributed, treasuryOwed: _treasuryOwed});
        uint256 u = r.undistributed;
        if (u == 0) return r;
        uint256 end = _streamEnd;
        uint256 last = _lastRelease;
        uint256 released = block.timestamp >= end ? u : (u * (block.timestamp - last)) / (end - last);
        if (released == 0) return r;
        r.undistributed = u - released;
        uint256 w = totalWeight;
        if (w == 0) {
            r.treasuryOwed += released;
        } else {
            uint256 num = released * ACC_SCALE + r.carry;
            r.acc += num / w;
            r.carry = num % w;
        }
    }

    /// @dev Pays ETH with `call`; if the recipient reverts the amount is credited to
    /// `owed[to]` instead, so a reverting recipient never blocks anyone.
    function _payETH(address to, uint256 amount) internal {
        _recordedBalance -= amount;
        bool ok;
        assembly ("memory-safe") {
            ok := call(gas(), to, amount, 0, 0, 0, 0)
        }
        if (!ok) {
            _recordedBalance += amount;
            owed[to] += amount;
            totalOwed += amount;
            emit Owed(to, amount);
        }
    }

    /// @dev Pulls this coin's Pons creator fees into the vault: sweeps pending fees from
    /// the curve (pre-graduation) or the hook pool (post-graduation) into the escrow when
    /// the vault is the creator fee recipient, then claims the escrow balance. Sweeps are
    /// best effort (Pons requires its operator for sweeps that need an internal swap), so
    /// their failure never blocks the escrow claim.
    function _pullPonsFees() internal {
        PonsLaunchedToken memory lt = IPonsV2LaunchFactory(ponsFactory).getLaunchedToken(token);
        if (lt.creatorFeeRecipient == address(this)) {
            if (lt.buybackEnabled) {
                // Buyback would pay this vault in the memecoin, which it cannot distribute.
                _tryCall(ponsFactory, abi.encodeCall(IPonsV2LaunchFactory.setBuybackEnabled, (token, false)));
            }
            if (lt.phase == PonsGraduationPhase.NotGraduated) {
                _tryCall(lt.curve, abi.encodeCall(IPonsV2BondingCurve.sweepFees, (0)));
            } else if (lt.phase == PonsGraduationPhase.PoolCreated) {
                bytes32 poolId = keccak256(abi.encode(address(0), token, lt.poolFee, lt.tickSpacing, memeHook));
                _tryCall(memeHook, abi.encodeCall(IPonsV2MemeHook.sweepPoolFees, (poolId, 0, 0)));
            }
        }
        if (IPonsV2FeeEscrow(feeEscrow).balanceOf(address(this)) != 0) {
            IPonsV2FeeEscrow(feeEscrow).claim();
        }
    }

    /// @dev Call whose failure is ignored, without copying return data.
    function _tryCall(address target, bytes memory data) internal {
        assembly ("memory-safe") {
            pop(call(gas(), target, 0, add(data, 32), mload(data), 0, 0))
        }
    }
}
