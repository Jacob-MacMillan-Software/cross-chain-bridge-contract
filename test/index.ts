import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockContract } from "@ethereum-waffle/mock-contract";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");

describe("Bridge", function () {
  it("Transfer a fungilbe token to another network", async function () {
    const [owner] = await ethers.getSigners();

    const mockERC20 = await deployMockContract(owner, IERC20.abi);

    await mockERC20.mock.transferFrom.returns(true);
    await mockERC20.mock.transfer.returns(true);

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = await Bridge.deploy();
    await bridge.deployed();

    // Initialzie bridge
    await bridge.initialize(owner.address);

    // Transfer a token to network 2
    const transferTx = await bridge.transferFungible(mockERC20.address, 100, 2);

    const tx = await transferTx.wait();

    expect(tx.events?.length).to.equal(1);

    await tx.events?.forEach((e) => {
      expect(e.args?.from).to.equal(owner.address);
      expect(e.args?.token).to.equal(mockERC20.address);
      expect(parseInt(e.args?.amount)).to.equal(100);
      expect(parseInt(e.args?.networkId)).to.equal(2);
    });
  });

  it("Claim a fungible token that was transfered", async function () {
    const [owner] = await ethers.getSigners();

    const mockERC20 = await deployMockContract(owner, IERC20.abi);

    await mockERC20.mock.transfer.returns(true);

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = await Bridge.deploy();
    await bridge.deployed();

    // Initialzie bridge
    await bridge.initialize(owner.address);

    await mockERC20.mock.balanceOf.withArgs(bridge.address).returns(100);

    await bridge.addClaimFungible(mockERC20.address, owner.address, 100);

    // Claim token
    const claimTx = await bridge.claimFungible(mockERC20.address, 100);
    const tx = await claimTx.wait();

    await tx.events?.forEach((e) => {
      expect(e.args?.from).to.equal(owner.address);
      expect(e.args?.token).to.equal(mockERC20.address);
      expect(parseInt(e.args?.amount)).to.equal(100);
    });
  });
});
