// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal slices of the Pons v2 launchpad that Clasp calls. Signatures and
/// struct layouts are copied from the verified Robinhood Chain sources (see
/// docs/SECURITY.md, "Pons integration"). Only what Clasp uses is declared.

/// @dev `GraduationPhase` from contracts/src/v2/interfaces/ILaunchpadV2.sol.
enum PonsGraduationPhase {
    NotGraduated,
    Swept,
    PoolCreated,
    Rescued
}

/// @dev `IPonsV2LaunchFactory.LaunchedToken`, same field order.
struct PonsLaunchedToken {
    address token;
    address curve;
    address deployer;
    address creatorFeeRecipient;
    address pairToken;
    uint256 graduationThreshold;
    uint24 poolFee;
    int24 tickSpacing;
    uint16 creatorTaxBps;
    bool buybackEnabled;
    PonsGraduationPhase phase;
    uint256 sweptQuote;
    uint256 sweptTokens;
    uint256 sweptAt;
    bool exists;
}

/// @dev `PonsV2LauncherToken.Socials`, same field order.
struct PonsSocials {
    string twitter;
    string telegram;
    string discord;
    string website;
    string farcaster;
}

/// @dev `PonsV2LaunchFactory.TokenParams`, same field order.
struct PonsTokenParams {
    string name;
    string symbol;
    string logo;
    string description;
    PonsSocials socials;
    address creatorFeeRecipient;
    uint16 creatorTaxBps;
    bool buybackEnabled;
    bytes32 expectedEconomics;
    bytes32 salt;
}

interface IPonsV2LaunchFactory {
    function getLaunchedToken(address token) external view returns (PonsLaunchedToken memory);
    function transferCreatorFeeRecipient(address token, address newRecipient) external;
    function setBuybackEnabled(address token, bool enabled) external;
    function launchToken(PonsTokenParams calldata params, uint256 launchConfigId, address pairToken)
        external
        payable
        returns (address token, address curve);
    function launchFee() external view returns (uint256);
    function feeEscrow() external view returns (address);
    function memeHook() external view returns (address);
    function poolManager() external view returns (address);
    function pendingCreatorFeeRecipient(address token)
        external
        view
        returns (address newRecipient, uint256 effectiveAt, uint256 expiresAt);
}

interface IPonsV2FeeEscrow {
    function claim() external returns (uint256 amount);
    function balanceOf(address recipient) external view returns (uint256);
}

interface IPonsV2BondingCurve {
    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensOut);
    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) external returns (uint256 quoteOut);
    function sweepFees(uint256 minBuybackTokensOut) external;
    function getReserves() external view returns (uint256 quoteReserve, uint256 tokenReserve);
    function sellableTokens() external view returns (uint256);
    function readyToGraduate() external view returns (bool);
    function graduated() external view returns (bool);
    function feeBps() external view returns (uint256);
    function creatorTaxBps() external view returns (uint256);
}

interface IPonsV2MemeHook {
    /// @dev Public getter of `mapping(PoolId => LaunchInfo) launches`, flattened.
    function launches(bytes32 poolId)
        external
        view
        returns (
            bool registered,
            bool memecoinIsCurrency0,
            address memecoin,
            address quoteToken,
            address creator,
            address buybackCreatorRecipient,
            address protocolFeeRecipient,
            uint16 creatorTaxBps,
            uint16 protocolFeeShareBps,
            uint16 buybackBurnBps,
            uint16 hookFeeBps,
            uint16 maxInternalPriceImpactBps,
            bool buybackEnabled
        );
    function sweepPoolFees(bytes32 poolId, uint256 minConversionQuoteOut, uint256 minBuybackTokensOut) external;
}
