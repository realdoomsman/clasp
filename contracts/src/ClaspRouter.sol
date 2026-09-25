// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {ProtocolFeeLibrary} from "@uniswap/v4-core/src/libraries/ProtocolFeeLibrary.sol";

import {IClaspRouter} from "./interfaces/IClaspRouter.sol";
import {IClaspFactory} from "./interfaces/IClaspFactory.sol";
import {IClaspVault} from "./interfaces/IClaspVault.sol";
import {
    IPonsV2LaunchFactory,
    IPonsV2BondingCurve,
    IPonsV2MemeHook,
    PonsLaunchedToken,
    PonsGraduationPhase
} from "./interfaces/IPons.sol";

/// @title ClaspRouter
/// @notice Stateless trading router for Clasp coins. Takes 2% of the ETH leg of every
/// trade (buy: of the ETH spent; sell: of the ETH the market pays out) and sends it to
/// the coin's vault in the same transaction. Routes through the Pons bonding curve before
/// graduation and through the Pons Uniswap v4 hook pool (ETH/token, hook
/// `PonsV2MemeHook`) after. Coins in the transient `Swept` phase or `Rescued` are not
/// tradeable and revert with `NotTradeable`.
contract ClaspRouter is IClaspRouter, IUnlockCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;

    uint256 public constant FEE_BPS = 200;
    uint256 internal constant BPS = 10_000;

    address public immutable factory;
    address public immutable ponsFactory;
    address public immutable poolManager;
    address public immutable memeHook;

    struct SwapData {
        PoolKey key;
        bool isBuy;
        uint256 amountIn;
        address recipient;
    }

    constructor(address factory_) {
        factory = factory_;
        ponsFactory = IClaspFactory(factory_).ponsFactory();
        memeHook = IClaspFactory(factory_).memeHook();
        poolManager = IPonsV2LaunchFactory(ponsFactory).poolManager();
    }

    /// @dev Receives curve refunds, curve sell proceeds and PoolManager `take`s.
    receive() external payable {}

    // =============================================================== trading

    /// @inheritdoc IClaspRouter
    function buy(address token, uint256 minOut, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (block.timestamp > deadline) revert Expired();
        if (msg.value == 0) revert ZeroAmount();
        address vault = _vault(token);
        PonsLaunchedToken memory lt = IPonsV2LaunchFactory(ponsFactory).getLaunchedToken(token);

        uint256 balanceBefore = address(this).balance - msg.value;
        uint256 fee = (msg.value * FEE_BPS) / BPS;
        uint256 net = msg.value - fee;

        if (lt.phase == PonsGraduationPhase.NotGraduated) {
            tokensOut = IPonsV2BondingCurve(lt.curve).buy{value: net}(net, minOut, msg.sender);
        } else if (lt.phase == PonsGraduationPhase.PoolCreated) {
            tokensOut = _swap(_poolKey(token, lt), true, net, msg.sender);
            if (tokensOut < minOut) revert Slippage(tokensOut, minOut);
        } else {
            revert NotTradeable();
        }

        // ETH the market did not use (curve clamp at graduation, v4 price limit) comes back
        // here; the fee is then charged only on what was actually spent.
        uint256 unused = address(this).balance - balanceBefore - fee;
        uint256 refund;
        if (unused != 0) {
            uint256 spent = net - unused;
            fee = (spent * FEE_BPS) / (BPS - FEE_BPS);
            refund = msg.value - spent - fee;
        }

        _payVault(vault, fee);
        if (refund != 0) _sendETH(msg.sender, refund);
        emit Trade(token, msg.sender, true, msg.value - refund, tokensOut, fee);
    }

    /// @inheritdoc IClaspRouter
    function sell(address token, uint256 amountIn, uint256 minEthOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256 ethOut)
    {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();
        address vault = _vault(token);
        PonsLaunchedToken memory lt = IPonsV2LaunchFactory(ponsFactory).getLaunchedToken(token);

        uint256 tokensBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 received = IERC20(token).balanceOf(address(this)) - tokensBefore;
        uint256 ethBefore = address(this).balance;

        if (lt.phase == PonsGraduationPhase.NotGraduated) {
            IERC20(token).forceApprove(lt.curve, received);
            IPonsV2BondingCurve(lt.curve).sell(received, 0, address(this));
        } else if (lt.phase == PonsGraduationPhase.PoolCreated) {
            _swap(_poolKey(token, lt), false, received, address(this));
        } else {
            revert NotTradeable();
        }

        uint256 gross = address(this).balance - ethBefore;
        uint256 fee = (gross * FEE_BPS) / BPS;
        ethOut = gross - fee;
        if (ethOut < minEthOut) revert Slippage(ethOut, minEthOut);

        // Tokens the market did not take (v4 price limit) go back to the trader.
        uint256 leftover = IERC20(token).balanceOf(address(this)) - tokensBefore;
        if (leftover != 0) IERC20(token).safeTransfer(msg.sender, leftover);

        _payVault(vault, fee);
        _sendETH(msg.sender, ethOut);
        emit Trade(token, msg.sender, false, gross, received - leftover, fee);
    }

    // =============================================================== quotes

    /// @inheritdoc IClaspRouter
    /// @dev Pre-graduation this mirrors `PonsV2BondingCurve.buy` exactly, except that the
    /// launch-window snipe tax (first seconds after launch) is ignored. Post-graduation it
    /// is an estimate from the pool's current price and in-range liquidity (exact while
    /// only the locked full-range position is active and no tick is crossed).
    function quoteBuy(address token, uint256 ethIn) external view returns (uint256 tokensOut, uint256 fee) {
        PonsLaunchedToken memory lt = IPonsV2LaunchFactory(ponsFactory).getLaunchedToken(token);
        fee = (ethIn * FEE_BPS) / BPS;
        uint256 net = ethIn - fee;
        if (lt.phase == PonsGraduationPhase.NotGraduated) {
            IPonsV2BondingCurve curve = IPonsV2BondingCurve(lt.curve);
            if (curve.readyToGraduate() || curve.graduated()) revert NotTradeable();
            (uint256 quoteReserve, uint256 tokenReserve) = curve.getReserves();
            uint256 netIn = net - (net * curve.feeBps()) / BPS - (net * curve.creatorTaxBps()) / BPS;
            tokensOut = _amountOut(netIn, quoteReserve, tokenReserve);
            uint256 sellable = curve.sellableTokens();
            if (tokensOut > sellable) tokensOut = sellable;
        } else if (lt.phase == PonsGraduationPhase.PoolCreated) {
            tokensOut = _quoteV4(token, lt, true, net);
        } else {
            revert NotTradeable();
        }
    }

    /// @inheritdoc IClaspRouter
    /// @dev Same caveats as `quoteBuy` for graduated coins.
    function quoteSell(address token, uint256 amountIn) external view returns (uint256 ethOut, uint256 fee) {
        PonsLaunchedToken memory lt = IPonsV2LaunchFactory(ponsFactory).getLaunchedToken(token);
        uint256 gross;
        if (lt.phase == PonsGraduationPhase.NotGraduated) {
            IPonsV2BondingCurve curve = IPonsV2BondingCurve(lt.curve);
            if (curve.readyToGraduate() || curve.graduated()) revert NotTradeable();
            (uint256 quoteReserve, uint256 tokenReserve) = curve.getReserves();
            uint256 out = _amountOut(amountIn, tokenReserve, quoteReserve);
            gross = out - (out * curve.feeBps()) / BPS - (out * curve.creatorTaxBps()) / BPS;
        } else if (lt.phase == PonsGraduationPhase.PoolCreated) {
            gross = _quoteV4(token, lt, false, amountIn);
        } else {
            revert NotTradeable();
        }
        fee = (gross * FEE_BPS) / BPS;
        ethOut = gross - fee;
    }

    // =============================================================== v4

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != poolManager) revert NotPoolManager();
        SwapData memory s = abi.decode(data, (SwapData));
        IPoolManager pm = IPoolManager(poolManager);

        BalanceDelta delta = pm.swap(
            s.key,
            SwapParams({
                zeroForOne: s.isBuy,
                amountSpecified: -SafeCast.toInt256(s.amountIn),
                sqrtPriceLimitX96: s.isBuy ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        // currency0 is always native ETH for an ETH-paired Pons pool.
        int128 d0 = delta.amount0();
        int128 d1 = delta.amount1();
        uint256 out;
        if (s.isBuy) {
            if (d0 < 0) {
                pm.sync(s.key.currency0);
                pm.settle{value: uint256(uint128(-d0))}();
            }
            out = d1 > 0 ? uint256(uint128(d1)) : 0;
            if (out != 0) pm.take(s.key.currency1, s.recipient, out);
        } else {
            if (d1 < 0) {
                pm.sync(s.key.currency1);
                IERC20(Currency.unwrap(s.key.currency1)).safeTransfer(poolManager, uint256(uint128(-d1)));
                pm.settle();
            }
            out = d0 > 0 ? uint256(uint128(d0)) : 0;
            if (out != 0) pm.take(s.key.currency0, s.recipient, out);
        }
        return abi.encode(out);
    }

    function _swap(PoolKey memory key, bool isBuy, uint256 amountIn, address recipient) internal returns (uint256) {
        bytes memory result =
            IPoolManager(poolManager).unlock(abi.encode(SwapData(key, isBuy, amountIn, recipient)));
        return abi.decode(result, (uint256));
    }

    function _poolKey(address token, PonsLaunchedToken memory lt) internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: lt.poolFee,
            tickSpacing: lt.tickSpacing,
            hooks: IHooks(memeHook)
        });
    }

    function _quoteV4(address token, PonsLaunchedToken memory lt, bool isBuy, uint256 amountIn)
        internal
        view
        returns (uint256 out)
    {
        if (amountIn == 0) return 0;
        PoolKey memory key = _poolKey(token, lt);
        PoolId id = key.toId();
        IPoolManager pm = IPoolManager(poolManager);
        (uint160 sqrtPrice,, uint24 protocolFee, uint24 lpFee) = StateLibrary.getSlot0(pm, id);
        uint128 liquidity = StateLibrary.getLiquidity(pm, id);
        if (liquidity == 0 || sqrtPrice == 0) return 0;

        uint16 pf = isBuy ? ProtocolFeeLibrary.getZeroForOneFee(protocolFee) : ProtocolFeeLibrary.getOneForZeroFee(protocolFee);
        uint24 swapFee = pf == 0 ? lpFee : ProtocolFeeLibrary.calculateSwapFee(pf, lpFee);
        uint256 inLessFee = (amountIn * (1e6 - swapFee)) / 1e6;
        uint160 next = SqrtPriceMath.getNextSqrtPriceFromInput(sqrtPrice, liquidity, inLessFee, isBuy);
        out = isBuy
            ? SqrtPriceMath.getAmount1Delta(next, sqrtPrice, liquidity, false)
            : SqrtPriceMath.getAmount0Delta(sqrtPrice, next, liquidity, false);

        // PonsV2MemeHook takes hookFeeBps + creatorTaxBps of the output (the unspecified leg).
        (,,,,,,, uint16 creatorTaxBps,,, uint16 hookFeeBps,,) = IPonsV2MemeHook(memeHook).launches(PoolId.unwrap(id));
        out -= (out * hookFeeBps) / BPS + (out * creatorTaxBps) / BPS;
    }

    // =============================================================== helpers

    function _vault(address token) internal view returns (address vault) {
        vault = IClaspFactory(factory).vaultOf(token);
        if (vault == address(0)) revert NoVault();
    }

    /// @dev Constant-product output, identical to `PonsV2BondingCurveMath._amountOut` with a zero fee.
    function _amountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return 0;
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    function _payVault(address vault, uint256 fee) internal {
        if (fee == 0) return;
        _sendETH(vault, fee);
        IClaspVault(vault).sync();
    }

    function _sendETH(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
