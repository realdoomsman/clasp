// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IClaspRouter {
    /// @param ethAmount buy: ETH the trader spent including the fee; sell: ETH the
    /// market paid out before the fee. `fee` is the 2% sent to the coin's vault.
    event Trade(
        address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 fee
    );

    error Expired();
    error NoVault();
    error NotTradeable();
    error ZeroAmount();
    error Slippage(uint256 actual, uint256 minimum);
    error NotPoolManager();
    error TransferFailed();

    function FEE_BPS() external view returns (uint256);
    function factory() external view returns (address);
    function ponsFactory() external view returns (address);
    function poolManager() external view returns (address);
    function memeHook() external view returns (address);

    function buy(address token, uint256 minOut, uint256 deadline) external payable returns (uint256 tokensOut);
    function sell(address token, uint256 amountIn, uint256 minEthOut, uint256 deadline)
        external
        returns (uint256 ethOut);

    /// @return tokensOut tokens the trader would receive for `ethIn` (fee included in `ethIn`).
    /// @return fee Clasp fee taken from `ethIn`.
    function quoteBuy(address token, uint256 ethIn) external view returns (uint256 tokensOut, uint256 fee);
    /// @return ethOut ETH the trader would receive after the fee.
    /// @return fee Clasp fee taken from the market's ETH output.
    function quoteSell(address token, uint256 amountIn) external view returns (uint256 ethOut, uint256 fee);
}
