// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Terms} from "../libraries/ClaspMath.sol";

/// @notice One lock position. `rewardDebt` and `rewardCredit` are scaled by 1e18.
struct Position {
    address owner;
    uint48 lockStart;
    uint48 lockEnd;
    uint32 multiplierBps;
    uint256 amount;
    uint256 weight;
    uint256 rewardDebt;
    uint256 rewardCredit;
    uint256 claimed;
}

interface IClaspVault {
    // ---------------------------------------------------------------- events
    event Locked(
        uint256 indexed id,
        address indexed owner,
        uint256 amount,
        uint256 durationSecs,
        uint256 multiplierBps,
        uint256 weight,
        uint256 lockEnd
    );
    /// @param amount tokens added; `weight` is the position's new total weight.
    event Increased(uint256 indexed id, uint256 amount, uint256 weight, uint256 lockStart);
    /// @dev An extension restarts the lock: `lockStart` becomes the block timestamp.
    event Extended(uint256 indexed id, uint256 lockEnd, uint256 multiplierBps, uint256 weight);
    event Claimed(uint256 indexed id, address indexed owner, uint256 amount);
    /// @param amount tokens returned to the owner; `burned` tokens sent to 0x…dEaD;
    /// `forfeited` ETH (wei) of unclaimed rewards returned to the stream.
    event Unlocked(uint256 indexed id, address indexed owner, uint256 amount, uint256 burned, uint256 forfeited, bool early);
    event FeesArrived(uint256 amount, uint256 toLockers, uint256 toTreasury);
    event TreasuryClaimed(uint256 amount);
    event Owed(address indexed recipient, uint256 amount);
    event OwedWithdrawn(address indexed recipient, address to, uint256 amount);

    // ---------------------------------------------------------------- errors
    error NotOwner();
    error UnknownPosition();
    error AmountTooSmall();
    error InvalidDuration();
    error NotMatured();
    error AlreadyMatured();
    error ExtendMustIncreaseEnd();
    error ZeroAddress();
    error NothingOwed();
    error TransferFailed();
    error UnrecordedOutflow();

    // ---------------------------------------------------------------- config
    function factory() external view returns (address);
    function token() external view returns (address);
    function treasury() external view returns (address);
    function ponsFactory() external view returns (address);
    function feeEscrow() external view returns (address);
    function terms() external view returns (Terms memory);

    // ---------------------------------------------------------------- actions
    function lock(uint256 amount, uint256 durationSecs) external returns (uint256 id);
    function lockFor(address owner, uint256 amount, uint256 durationSecs) external returns (uint256 id);
    function increase(uint256 id, uint256 amount) external;
    function extend(uint256 id, uint256 durationSecs) external;
    function claim(uint256 id) external returns (uint256 amount);
    function claimAll(uint256[] calldata ids) external returns (uint256 amount);
    function unlock(uint256 id) external;
    function earlyUnlock(uint256 id) external;
    function harvest() external returns (uint256 arrived);
    function sync() external returns (uint256 arrived);
    function claimTreasury() external returns (uint256 amount);
    function withdrawOwed(address to) external returns (uint256 amount);

    // ---------------------------------------------------------------- views
    function pending(uint256 id) external view returns (uint256);
    function position(uint256 id) external view returns (Position memory);
    function positionsOf(address owner) external view returns (uint256[] memory);
    function positionCount() external view returns (uint256);
    function totalWeight() external view returns (uint256);
    function totalLocked() external view returns (uint256);
    function undistributed() external view returns (uint256);
    function streamEnd() external view returns (uint256);
    function accRewardPerWeight() external view returns (uint256);
    function treasuryOwed() external view returns (uint256);
    function totalOwed() external view returns (uint256);
    function owed(address account) external view returns (uint256);
    function lifetimeInflow() external view returns (uint256);
    function lifetimeRewards() external view returns (uint256);
    function isFeeRecipient() external view returns (bool);
    function previewMultiplier(uint256 amount, uint256 durationSecs)
        external
        view
        returns (uint256 multiplierBps, uint256 weight);
    function previewIncrease(uint256 id, uint256 amount)
        external
        view
        returns (uint256 multiplierBps, uint256 weight, uint256 lockStart);
    function previewEarlyUnlock(uint256 id) external view returns (uint256 burn, uint256 returned, uint256 forfeited);
}
