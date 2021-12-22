import { expect } from "chai";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-extraneous-import
import { deployMockContract } from "@ethereum-waffle/mock-contract";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const IERC721 = require("../artifacts/contracts/IERC721Bridgable.sol/IERC721Bridgable.json");
const IERC1155 = require("../artifacts/contracts/IERC1155Bridgable.sol/IERC1155Bridgable.json");

describe("Bridge", function () {
  describe("ERC20 bridge", function () {
    it("Transfer a fungilbe token to another network", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transferFrom.returns(true);
      await mockERC20.mock.transfer.returns(true);

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
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

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC20.mock.balanceOf.withArgs(bridge.address).returns(100);

      // Claim token
      const claimTx = await bridge.bridgeClaimFungible(
        mockERC20.address,
        owner.address,
        100
      );
      const tx = await claimTx.wait();

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC20.address);
        expect(parseInt(e.args?.amount)).to.equal(100);
      });
    });
  });

  describe("ERC721 Bridge", function () {
    it("Transfer a non-fungilbe token to another network (NFT does not exist)", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
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
      await mockERC721.mock.ownerOf.withArgs(1).reverts();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC721.mock.ownerOf.withArgs(1).returns(bridge.address);

      // Claim token
      const claimTx = await bridge.bridgeClaimNonFungible(
        mockERC721.address,
        owner.address,
        1
      );
      const tx = await claimTx.wait();

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
      });
    });
  });

  describe("ERC1155 bridge", function () {
    it("Transfer a fungilbe token to another network", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      // Transfer a token to network 2
      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        1,
        100,
        2
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC1155.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.amount)).to.equal(100);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Claim a fungible token that was transfered", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      await mockERC1155.mock.balanceOf.withArgs(bridge.address, 1).returns(100);

      // Claim token
      const claimTx = await bridge.bridgeClaimMixedFungible(
        mockERC1155.address,
        owner.address,
        1,
        100
      );
      const tx = await claimTx.wait();

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC1155.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.amount)).to.equal(100);
      });
    });
  });
});
