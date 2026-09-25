// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ClaspFactory} from "../../src/ClaspFactory.sol";
import {ClaspRouter} from "../../src/ClaspRouter.sol";
import {ClaspLauncher} from "../../src/ClaspLauncher.sol";
import {ClaspVault} from "../../src/ClaspVault.sol";
import {LaunchParams} from "../../src/interfaces/IClaspLauncher.sol";
import {IPonsV2LaunchFactory, IPonsV2FeeEscrow, PonsLaunchedToken, PonsSocials} from "../../src/interfaces/IPons.sol";
import {defaultTerms} from "../utils/Base.sol";

/// @dev Extra Pons views used only by the fork tests.
interface IPonsCurveViews {
    function deployer() external view returns (address);
    function quoteFeeBalance() external view returns (uint256);
    function creatorTaxBalance() external view returns (uint256);
    function protocolFeeShareBps() external view returns (uint16);
    function snipeTaxSeconds() external view returns (uint256);
}

interface IPonsFactoryExtra {
    function createGraduatedPool(address token) external returns (uint256 positionId);
}

interface IPonsHookExtra {
    function feeSweepOperator() external view returns (address);
    function pendingFees(bytes32 poolId, address currency) external view returns (uint256);
    function pendingCreatorTax(bytes32 poolId, address currency) external view returns (uint256);
}

/// @dev Fork tests run against Robinhood Chain mainnet state. They are skipped unless
/// `ROBINHOOD_RPC_URL` is set (or the suite already runs with `--fork-url`):
///   ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com forge test --match-path 'test/fork/*'
/// Optional `FORK_BLOCK` pins the block.
abstract contract ForkBase is Test {
    address constant PONS_FACTORY = 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    address constant PONS_ESCROW = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    address constant PONS_HOOK = 0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044;
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant PYRE = 0xc8488bE2e4f430420A364E64f4D8af428b74D903;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IPonsV2LaunchFactory internal pons = IPonsV2LaunchFactory(PONS_FACTORY);
    IPonsV2FeeEscrow internal escrow = IPonsV2FeeEscrow(PONS_ESCROW);

    ClaspFactory internal factory;
    ClaspRouter internal router;
    ClaspLauncher internal launcher;

    address internal owner = makeAddr("claspOwner");
    address internal treasury = makeAddr("claspTreasury");
    address internal creator = makeAddr("creator");
    address internal trader = makeAddr("trader");
    address internal trader2 = makeAddr("trader2");
    address internal keeper = makeAddr("keeper");

    function setUp() public virtual {
        if (block.chainid != 4663) {
            string memory rpc = vm.envOr("ROBINHOOD_RPC_URL", string(""));
            if (bytes(rpc).length == 0) {
                vm.skip(true);
                return;
            }
            uint256 blockNumber = vm.envOr("FORK_BLOCK", uint256(0));
            if (blockNumber == 0) vm.createSelectFork(rpc);
            else vm.createSelectFork(rpc, blockNumber);
        }
        factory = new ClaspFactory(owner, treasury, PONS_FACTORY, defaultTerms());
        router = new ClaspRouter(address(factory));
        launcher = new ClaspLauncher(address(factory));
        vm.deal(creator, 100 ether);
        vm.deal(trader, 100 ether);
        vm.deal(trader2, 100 ether);
    }

    function _launchParams(uint256 devBuy, uint16 lockPercent, uint32 lockSecs, bytes32 salt)
        internal
        view
        returns (LaunchParams memory)
    {
        return LaunchParams({
            name: "Clasp Fork Test",
            symbol: "CLSPT",
            logo: "",
            description: "fork test",
            socials: PonsSocials("", "", "", "", ""),
            creatorTaxBps: 100,
            salt: salt,
            expectedEconomics: bytes32(0),
            launchConfigId: 0,
            devBuyEth: devBuy,
            minTokensOut: 0,
            lockPercent: lockPercent,
            lockSecs: lockSecs,
            expectedTermsHash: factory.defaultsHash(),
            expectedTreasury: factory.treasury()
        });
    }

    function _launch(uint256 devBuy, uint16 lockPercent, uint32 lockSecs, bytes32 salt)
        internal
        returns (address token, ClaspVault vault, uint256 lockId, uint256 bought)
    {
        uint256 fee = pons.launchFee();
        LaunchParams memory p = _launchParams(devBuy, lockPercent, lockSecs, salt); // before the prank
        vm.prank(creator);
        address v;
        (token, v, lockId, bought) = launcher.launch{value: fee + devBuy}(p);
        vault = ClaspVault(payable(v));
    }

    function _poolId(address token) internal view returns (bytes32) {
        PonsLaunchedToken memory lt = pons.getLaunchedToken(token);
        return keccak256(abi.encode(address(0), token, lt.poolFee, lt.tickSpacing, PONS_HOOK));
    }

    function _deadline() internal view returns (uint256) {
        return vm.getBlockTimestamp() + 300;
    }

    function _buy(address who, address token, uint256 eth) internal returns (uint256 out) {
        vm.prank(who);
        out = router.buy{value: eth}(token, 0, _deadline());
    }

    function _sell(address who, address token, uint256 amount) internal returns (uint256 out) {
        vm.startPrank(who);
        IERC20(token).approve(address(router), amount);
        out = router.sell(token, amount, 0, _deadline());
        vm.stopPrank();
    }
}
