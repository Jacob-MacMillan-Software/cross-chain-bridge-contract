import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockContract } from "@ethereum-waffle/mock-contract";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const IERC721 = require("../artifacts/contracts/IERC721Bridgable.sol/IERC721Bridgable.json");

describe("Bridge", function () {

  describe("ERC20 bridge", function () {
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
      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        2
      );

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

  describe("ERC721 Bridge", function () {
    it("Transfer a non-fungilbe token to another network", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();

      const Bridge = await ethers.getContractFactory("Bridge");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      // Transfer a token to network 2
      const transferTx = await bridge.transferNonFungible(
        mockERC721.address,
        1,
        2
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Claim a non-fungible token that was transfered and the NFT exist and is owned by bridge contract", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();

      const Bridge = await ethers.getContractFactory("Bridge");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC721.mock.ownerOf.withArgs(1).returns(bridge.address);

      await bridge.addClaimNonFungible(mockERC721.address, owner.address, 1);

      // Claim token
      const claimTx = await bridge.claimNonFungible(mockERC721.address, 1);
      const tx = await claimTx.wait();

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
      });
    });
  });
});
