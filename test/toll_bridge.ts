import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
// eslint-disable-next-line node/no-extraneous-import
import { deployMockContract } from "@ethereum-waffle/mock-contract";
// eslint-disable-next-line node/no-missing-import
import { generateHashedMessage } from "./helpers/messageSigning";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const IERC721 = require("../artifacts/contracts/IERC721Bridgable.sol/IERC721Bridgable.json");
const IERC1155 = require("../artifacts/contracts/IERC1155Bridgable.sol/IERC1155Bridgable.json");
const abi = new ethers.utils.AbiCoder();

const zeroAddress = "0x0000000000000000000000000000000000000000";
const fakeFeeTokenAddr = "0x1111111111111111111111111111111111111111";
const noExpireBlock = 999999999;

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
      const [owner, addr1] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transferFrom.returns(true);
      await mockERC20.mock.transfer.returns(true);

      tollToken.mock.transferFrom.reverts(); // This function shouldn't be called

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        addr1.address,
      ]);
      await bridge.deployed();

      // Generate fee verification
      const [hash, signature] = await generateHashedMessage(
        owner.address,
        2,
        fakeFeeTokenAddr,
        0,
        noExpireBlock,
        mockERC20.address,
        addr1
      );

      // Transfer a token to network 2
      const transferTx = await bridge.transferFungibleWF(
        mockERC20.address,
        100,
        2,
        abi.encode(
          ["address", "uint256", "uint256"],
          [fakeFeeTokenAddr, 0, noExpireBlock]
        ),
        hash,
        signature
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
      const [owner, addr1] = await ethers.getSigners();

      const mockERC20 = await deployMockContract(owner, IERC20.abi);

      await mockERC20.mock.transfer.returns(true);

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      await mockERC20.mock.balanceOf.withArgs(bridge.address).returns(100);

      // Claim token
      const claimTx = await bridge.bridgeClaimFungibleWithFeeRebate(
        mockERC20.address,
        addr1.address,
        100,
        0
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(addr1.address);
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

      // Claim token
      let pass: boolean = false;
      try {
        await bridge.bridgeClaimFungibleWithFeeRebate(
          mockERC20.address,
          owner.address,
          100,
          1000
        );
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

      // Claim token
      const claimTx = await bridge.bridgeClaimNonFungible(
        mockERC721.address,
        owner.address,
        1
      );
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

      let pass: boolean = false;
      // Transfer a token to network 2
      try {
        await bridge.bridgeClaimNonFungibleWithFeeRebate(
          mockERC721.address,
          owner.address,
          1,
          100
        );
      } /* @ts-ignore */ catch (err) {
        expect(String(err).includes("Test Working")).to.equal(true);
        pass = true;
      }

      expect(pass).to.equal(true);
    });

    it("Claim a non-fungible token that was transfered and the NFT exist and is owned by bridge contract with no fee rebate", async function () {
      const [owner, addr1] = await ethers.getSigners();

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

      // Claim token
      const claimTx = await bridge.bridgeClaimNonFungibleWithFeeRebate(
        mockERC721.address,
        addr1.address,
        1,
        0
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(addr1.address);
        expect(e.args?.token).to.equal(mockERC721.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
      });
    });
  });

  describe("ERC1155 bridge", function () {
    it("Transfer a mixed fungilbe token to another network with no fee", async function () {
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

    it("Transfer a mixed fungilbe token to another network with fee", async function () {
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

    it("Claim a mixed fungible token that was transfered with fee rebate", async function () {
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

      // We'll use this to verify the fee is being taken
      await tollToken.mock.transfer
        .withArgs(owner.address, 100)
        .revertsWithReason("Test Working");

      // Claim token
      let pass: boolean = false;
      try {
        await bridge.bridgeClaimMixedFungibleWithFeeRebate(
          mockERC1155.address,
          owner.address,
          1,
          100,
          100
        );
      } /* @ts-ignore */ catch (err) {
        expect(String(err).includes("Test Working")).to.equal(true);
        pass = true;
      }

      expect(pass).to.equal(true);
    });

    it("Claim a mixed fungible token that was transfered with no fee rebate", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const mockERC1155 = await deployMockContract(owner, IERC1155.abi);

      await mockERC1155.mock.safeTransferFrom.returns();

      const Bridge = await ethers.getContractFactory("TollBridge");
      const bridge = await upgrades.deployProxy(Bridge, [
        owner.address,
        tollToken.address,
      ]);
      await bridge.deployed();

      await mockERC1155.mock.balanceOf.withArgs(bridge.address, 1).returns(100);

      // Claim token
      const claimTx = await bridge.bridgeClaimMixedFungibleWithFeeRebate(
        mockERC1155.address,
        addr1.address,
        1,
        100,
        0
      );
      const tx = await claimTx.wait();

      // @ts-ignore
      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(addr1.address);
        expect(e.args?.token).to.equal(mockERC1155.address);
        expect(parseInt(e.args?.tokenId)).to.equal(1);
        expect(parseInt(e.args?.amount)).to.equal(100);
      });
    });
  });
});
