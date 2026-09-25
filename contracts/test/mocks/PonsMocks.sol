// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    PonsLaunchedToken, PonsGraduationPhase, PonsTokenParams
} from "../../src/interfaces/IPons.sol";

contract MockToken is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Mirrors PonsV2FeeEscrow's native-ETH ledger.
contract MockEscrow {
    error NoBalance();

    mapping(address => uint256) public balanceOf;

    function credit(address recipient) external payable {
        balanceOf[recipient] += msg.value;
    }

    function claim() external returns (uint256 amount) {
        amount = balanceOf[msg.sender];
        if (amount == 0) revert NoBalance();
        balanceOf[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "send");
    }
}

/// @dev Stands in for PonsV2MemeHook: `sweepPoolFees` credits the pool's pending ETH to
/// the creator in the escrow, and reverts for anyone but the creator.
contract MockHook {
    MockEscrow public immutable escrow;
    mapping(bytes32 => address) public creatorOf;
    mapping(bytes32 => uint256) public pendingEth;
    bool public requireOperator;

    constructor(MockEscrow escrow_) {
        escrow = escrow_;
    }

    function setPool(bytes32 poolId, address creator) external {
        creatorOf[poolId] = creator;
    }

    function setRequireOperator(bool v) external {
        requireOperator = v;
    }

    function accrue(bytes32 poolId) external payable {
        pendingEth[poolId] += msg.value;
    }

    function sweepPoolFees(bytes32 poolId, uint256, uint256) external {
        require(msg.sender == creatorOf[poolId], "NotFeeSweepOperator");
        require(!requireOperator, "InternalSwapRequiresOperator");
        uint256 amount = pendingEth[poolId];
        pendingEth[poolId] = 0;
        if (amount != 0) escrow.credit{value: amount}(msg.sender);
    }

    function launches(bytes32)
        external
        pure
        returns (bool, bool, address, address, address, address, address, uint16, uint16, uint16, uint16, uint16, bool)
    {
        return (true, false, address(0), address(0), address(0), address(0), address(0), 0, 3000, 5000, 100, 300, false);
    }
}

/// @dev Constant-product curve with the same pricing, fee, clamp and refund behaviour as
/// PonsV2BondingCurve (minus snipe tax and buyback). Fees accrue here until the creator
/// (`deployer`) sweeps them into the escrow.
contract MockCurve {
    uint256 internal constant BPS = 10_000;

    address public immutable factory;
    MockEscrow public immutable escrow;
    address public token;
    address public deployer;
    uint256 public immutable phantomQuote;
    uint256 public immutable feeBps;
    uint256 public immutable creatorTaxBps;
    uint256 public trackedQuote;
    uint256 public trackedTokens;
    uint256 public reservedTokens;
    uint256 public quoteFeeBalance;
    uint256 public creatorTaxBalance;
    bool public graduated;

    constructor(address factory_, MockEscrow escrow_, address deployer_, uint256 phantom, uint256 fee, uint256 tax) {
        factory = factory_;
        escrow = escrow_;
        deployer = deployer_;
        phantomQuote = phantom;
        feeBps = fee;
        creatorTaxBps = tax;
    }

    function initialize(address token_, uint256 reserved) external {
        token = token_;
        trackedTokens = IERC20(token_).balanceOf(address(this));
        reservedTokens = reserved;
    }

    function setCreatorFeeRecipient(address r) external {
        require(msg.sender == factory, "NotFactory");
        deployer = r;
    }

    function setGraduated(bool g) external {
        graduated = g;
    }

    function getReserves() public view returns (uint256, uint256) {
        return (phantomQuote + trackedQuote - quoteFeeBalance - creatorTaxBalance, trackedTokens);
    }

    function sellableTokens() public view returns (uint256) {
        return trackedTokens > reservedTokens ? trackedTokens - reservedTokens : 0;
    }

    function readyToGraduate() public view returns (bool) {
        return !graduated && sellableTokens() == 0;
    }

    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 out) {
        require(!graduated, "CurveGraduated");
        require(msg.value == quoteIn, "NativeValueMismatch");
        (uint256 qr, uint256 tr) = getReserves();
        uint256 spent = quoteIn;
        uint256 fee = (spent * feeBps) / BPS;
        uint256 tax = (spent * creatorTaxBps) / BPS;
        out = ((spent - fee - tax) * tr) / (qr + spent - fee - tax);
        uint256 sellable = sellableTokens();
        require(sellable != 0, "CurveGraduated");
        if (out > sellable) {
            out = sellable;
            uint256 net = (sellable * qr) / (tr - sellable) + 1;
            spent = (net * BPS + (BPS - feeBps - creatorTaxBps) - 1) / (BPS - feeBps - creatorTaxBps);
            if (spent > quoteIn) spent = quoteIn;
            fee = (spent * feeBps) / BPS;
            tax = (spent * creatorTaxBps) / BPS;
        }
        require(spent * minTokensOut <= quoteIn * out, "SlippageExceeded");
        quoteFeeBalance += fee;
        creatorTaxBalance += tax;
        trackedQuote += spent;
        trackedTokens -= out;
        IERC20(token).transfer(recipient, out);
        if (quoteIn > spent) {
            (bool ok,) = msg.sender.call{value: quoteIn - spent}("");
            require(ok, "refund");
        }
    }

    function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) external returns (uint256 quoteOut) {
        require(!graduated && !readyToGraduate(), "CurveGraduated");
        (uint256 qr, uint256 tr) = getReserves();
        IERC20(token).transferFrom(msg.sender, address(this), tokensIn);
        uint256 gross = (tokensIn * qr) / (tr + tokensIn);
        uint256 fee = (gross * feeBps) / BPS;
        uint256 tax = (gross * creatorTaxBps) / BPS;
        quoteOut = gross - fee - tax;
        require(quoteOut >= minQuoteOut, "SlippageExceeded");
        quoteFeeBalance += fee;
        creatorTaxBalance += tax;
        trackedQuote -= quoteOut;
        trackedTokens += tokensIn;
        (bool ok,) = recipient.call{value: quoteOut}("");
        require(ok, "send");
    }

    /// @dev 30% of the base fee to the protocol, the rest plus the tax to the creator.
    function sweepFees(uint256) external {
        require(msg.sender == deployer, "NotFeeSweepOperator");
        uint256 protocolAmount = (quoteFeeBalance * 3000) / BPS;
        uint256 creatorAmount = quoteFeeBalance - protocolAmount + creatorTaxBalance;
        trackedQuote -= protocolAmount + creatorAmount;
        quoteFeeBalance = 0;
        creatorTaxBalance = 0;
        if (creatorAmount != 0) escrow.credit{value: creatorAmount}(deployer);
        if (protocolAmount != 0) escrow.credit{value: protocolAmount}(address(0xFEE));
    }
}

/// @dev Stands in for PonsV2LaunchFactory: launch records, recipient transfer, buyback
/// flag and a `launchToken` that deploys a MockToken + MockCurve pair.
contract MockPonsFactory {
    error TokenNotFound();
    error NotCreatorFeeRecipient();
    error LaunchFeeNotPaid();

    MockEscrow public immutable escrow;
    MockHook public immutable hook;
    uint256 public launchFee = 0.0005 ether;
    uint256 public supply = 1e27;
    uint256 public phantomQuote = 1.68 ether;
    uint256 public graduationThreshold = 4.2 ether;

    mapping(address => PonsLaunchedToken) internal _launched;

    constructor() {
        escrow = new MockEscrow();
        hook = new MockHook(escrow);
    }

    function feeEscrow() external view returns (address) {
        return address(escrow);
    }

    function memeHook() external view returns (address) {
        return address(hook);
    }

    function poolManager() external pure returns (address) {
        return address(0x4444);
    }

    function getLaunchedToken(address token) external view returns (PonsLaunchedToken memory) {
        return _launched[token];
    }

    function setLaunched(address token, PonsLaunchedToken memory lt) external {
        _launched[token] = lt;
    }

    function setPhase(address token, PonsGraduationPhase phase) external {
        _launched[token].phase = phase;
    }

    function setBuybackFlag(address token, bool enabled) external {
        _launched[token].buybackEnabled = enabled;
    }

    function setBuybackEnabled(address token, bool enabled) external {
        PonsLaunchedToken storage lt = _launched[token];
        if (!lt.exists) revert TokenNotFound();
        require(msg.sender == lt.creatorFeeRecipient && !enabled, "NotBuybackController");
        lt.buybackEnabled = enabled;
    }

    function transferCreatorFeeRecipient(address token, address newRecipient) external {
        PonsLaunchedToken storage lt = _launched[token];
        if (!lt.exists) revert TokenNotFound();
        if (msg.sender != lt.creatorFeeRecipient) revert NotCreatorFeeRecipient();
        lt.creatorFeeRecipient = newRecipient;
        if (lt.curve.code.length != 0) MockCurve(payable(lt.curve)).setCreatorFeeRecipient(newRecipient);
    }

    function launchToken(PonsTokenParams calldata params, uint256, address pairToken)
        external
        payable
        returns (address token, address curve)
    {
        if (msg.value != launchFee) revert LaunchFeeNotPaid();
        address recipient = params.creatorFeeRecipient == address(0) ? msg.sender : params.creatorFeeRecipient;
        MockCurve c = new MockCurve{salt: params.salt}(address(this), escrow, recipient, phantomQuote, 100, params.creatorTaxBps);
        MockToken t = new MockToken{salt: params.salt}(params.name, params.symbol);
        t.mint(address(c), supply);
        c.initialize(address(t), (supply * phantomQuote) / (phantomQuote + graduationThreshold));
        token = address(t);
        curve = address(c);
        _launched[token] = PonsLaunchedToken({
            token: token,
            curve: curve,
            deployer: msg.sender,
            creatorFeeRecipient: recipient,
            pairToken: pairToken,
            graduationThreshold: graduationThreshold,
            poolFee: 0,
            tickSpacing: 200,
            creatorTaxBps: params.creatorTaxBps,
            buybackEnabled: params.buybackEnabled,
            phase: PonsGraduationPhase.NotGraduated,
            sweptQuote: 0,
            sweptTokens: 0,
            sweptAt: 0,
            exists: true
        });
    }
}
