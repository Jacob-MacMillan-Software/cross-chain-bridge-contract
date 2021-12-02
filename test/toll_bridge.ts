import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { deployMockContract } from "@ethereum-waffle/mock-contract";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const IERC721 = require("../artifacts/contracts/IERC721Bridgable.sol/IERC721Bridgable.json");
const IERC1155 = require("../artifacts/contracts/IERC1155Bridgable.sol/IERC1155Bridgable.json");

describe("Toll Bridge", function () {
  let tollToken: Contract;

  beforeEach(async function () {
    // Setup the token to use for tolls

    const [owner] = await ethers.getSigners();
    tollToken = await deployMockContract(owner, IERC20.abi);

    tollToken.mock.transferFrom.returns(true);
    tollToken.mock.transfer.returns(true);
    // Each unit test may modify the mock returns
  });

  describe("ERC20 bridge", function () {
    it("Transfer a fungilbe token to another network with no fee", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transferFrom.returns(true);
      await mockERC20.mock.transfer.returns(true);

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      // Transfer a token to network 2
      const transferTx = await bridge.transferFungible(
        mockERC20.address,
        100,
        2
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC20.address);
        expect(parseInt(e.args?.amount)).to.equal(100);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Claim a fungible token that was transfered with no fee rebate", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transfer.returns(true);

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      await mockERC20.mock.balanceOf.withArgs(bridge.address).returns(100);

      await bridge.addClaimFungible(mockERC20.address, owner.address, 100);

      // Claim token
      const claimTx = await bridge.claimFungible(mockERC20.address, 100);
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC20.address);
        expect(parseInt(e.args?.amount)).to.equal(100);
      });
    });

    it("Transfer a fungilbe token to another network with fee", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transferFrom.returns(true);
      await mockERC20.mock.transfer.returns(true);

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transferFrom
        .withArgs(owner.address, bridge.address, 1000)
        .revertsWithReason("Test Working");

      await bridge.changeFungibleFee(1000);

      let pass: boolean = false;
      try {
        await bridge.transferFungible(mockERC20.address, 100, 2);
      } /* @ts-ignore */ catch (err) {
        expect(String(err).includes("Test Working")).to.equal(true);
        pass = true;
      }

      expect(pass).to.equal(true);
    });

    it("Claim a fungible token that was transfered with fee rebate", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transfer.returns(true);

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transfer
        .withArgs(owner.address, 1000)
        .revertsWithReason("Test Working");

      await mockERC20.mock.balanceOf.withArgs(bridge.address).returns(100);

      await bridge.addClaimFungibleWithFeeRebate(
        mockERC20.address,
        owner.address,
        100,
        1000
      );

      // Claim token
      let pass: boolean = false;
      try {
        await bridge.claimFungible(mockERC20.address, 100);
      } /* @ts-ignore */ catch (err) {
        expect(String(err).includes("Test Working")).to.equal(true);
        pass = true;
      }

      expect(pass).to.equal(true);
    });
  });

  describe("ERC721 Bridge", function () {
    it("Transfer a non-fungilbe token to another network (NFT does not exist) with no fee", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      // Transfer a token to network 2
      const transferTx = await bridge.transferNonFungible(
        mockERC721.address,
        1,
        2
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Claim a non-fungible token that was transfered and the NFT exist and is owned by bridge contract with no fee rebate", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();
      await mockERC721.mock.ownerOf.withArgs(1).reverts();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      await mockERC721.mock.ownerOf.withArgs(1).returns(bridge.address);

      await bridge.addClaimNonFungible(mockERC721.address, owner.address, 1);

      // Claim token
      const claimTx = await bridge.claimNonFungible(mockERC721.address, 1);
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
      });
    });

    it("Transfer a non-fungilbe token to another network (NFT does not exist) with fee", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transferFrom
        .withArgs(owner.address, bridge.address, 1000)
        .revertsWithReason("Test Working");

      // Set fee
      await bridge.changeNonFungibleFee(1000);

      let pass: boolean = false;
      // Transfer a token to network 2
      try {
        await bridge.transferNonFungible(mockERC721.address, 1, 2);
      } /* @ts-ignore */ catch (err) {
        expect(String(err).includes("Test Working")).to.equal(true);
        pass = true;
      }

      expect(pass).to.equal(true);
    });

    it("Claim a non-fungible token that was transfered and the NFT exist and is owned by bridge contract with fee rebate", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC721 = await deployMockContract(owner, IERC721.abi);

      await mockERC721.mock.transferFrom.returns();
      await mockERC721.mock.ownerOf.withArgs(1).reverts();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transfer
        .withArgs(owner.address, 100)
        .revertsWithReason("Test Working");

      await mockERC721.mock.ownerOf.withArgs(1).returns(bridge.address);

      await bridge.addClaimNonFungibleWithFeeRebate(
        mockERC721.address,
        owner.address,
        1,
        100
      );

      let pass: boolean = false;
      // Transfer a token to network 2
      try {
        await bridge.claimNonFungible(mockERC721.address, 1);
      } /* @ts-ignore */ catch (err) {
        expect(String(err).includes("Test Working")).to.equal(true);
        pass = true;
      }

      expect(pass).to.equal(true);
    });
  });

  describe("ERC1155 bridge", function () {
    it("Transfer a fungilbe token to another network with no fee", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      // Transfer a token to network 2
      const transferTx = await bridge.transferMixedFungible(
        mockERC1155.address,
        1,
        100,
        2
      );

      const tx = await transferTx.wait();

      expect(tx.events?.length).to.equal(1);

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC1155.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.amount)).to.equal(100);
        expect(parseInt(e.args?.networkId)).to.equal(2);
      });
    });

    it("Claim a fungible token that was transfered with no fee rebate", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      await mockERC1155.mock.balanceOf.withArgs(bridge.address, 1).returns(100);

      await bridge.addClaimMixedFungible(
        mockERC1155.address,
        owner.address,
        1,
        100
      );

      // Claim token
      const claimTx = await bridge.claimMixedFungible(
        mockERC1155.address,
        1,
        100
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.token).to.equal(mockERC1155.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.amount)).to.equal(100);
      });
    });

    it("Transfer a fungilbe token to another network with fee", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transferFrom
        .withArgs(owner.address, bridge.address, 1000)
        .revertsWithReason("Test Working");

      // Set fee
      await bridge.changeMixedFungibleFee(1000);

      let pass: boolean = false;
      try {
        await bridge.transferMixedFungible(mockERC1155.address, 1, 100, 2);
      } /* @ts-ignore */ catch (err) {
        expect(String(err).includes("Test Working")).to.equal(true);
        pass = true;
      }

      expect(pass).to.equal(true);
    });

    it("Claim a fungible token that was transfered with no fee rebate", async function () {
      const [owner] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      await mockERC1155.mock.balanceOf.withArgs(bridge.address, 1).returns(100);

      await bridge.addClaimMixedFungibleWithFeeRebate(
        mockERC1155.address,
        owner.address,
        1,
        100,
        100
      );

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transfer
        .withArgs(owner.address, 100)
        .revertsWithReason("Test Working");

      // Claim token
      let pass: boolean = false;
      try {
        await bridge.claimMixedFungible(mockERC1155.address, 1, 100);
      } /* @ts-ignore */ catch (err) {
        expect(String(err).includes("Test Working")).to.equal(true);
        pass = true;
      }

      expect(pass).to.equal(true);
    });
  });
});
