import { expect } from "chai";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-extraneous-import
import { deployMockContract } from "@ethereum-waffle/mock-contract";

const IERC20 = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const IERC721 = require("../artifacts/contracts/IERC721Bridgable.sol/IERC721Bridgable.json");
const IERC1155 = require("../artifacts/contracts/IERC1155Bridgable.sol/IERC1155Bridgable.json");
const IMessageReceiver = require("../artifacts/contracts/IMessageReceiver.sol/IMessageReceiver.json");

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
        2,
        "0x"
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
        2,
        "0x"
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
        2,
        "0x"
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

  describe("Arbitrary message bridge", function () {
    // @ts-ignore
    let encodedMessage;
    // @ts-ignore
    let decodedMessage;

    before(function () {
      const abi = new ethers.utils.AbiCoder();

      decodedMessage = {
        types: ["string", "uint256"],
        data: ["This is a message", 17], // 17 is the length of the message
      };

      encodedMessage = abi.encode(decodedMessage.types, decodedMessage.data);
    });

    it("Send an arbitrary message to another network", async function () {
      const [owner, addr1] = await ethers.getSigners();

      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      const messageTx = await bridge.sendMessage(
        1, // Message ID
        100, // Destination Network
        addr1.address, // Recipient
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        "0x" // Extra data
      );

      const tx = await messageTx.wait();

      expect(tx.events?.length).to.equal(1);

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(parseInt(e.args?.messageId)).to.equal(1);
        expect(parseInt(e.args?.destination)).to.equal(100);
        expect(e.args?.recipient).to.equal(addr1.address);
        expect(e.args?.receipt).to.equal(false);
        // @ts-ignore
        expect(e.args?.message).to.equal(encodedMessage);
      });
    });

    it("Send an arbitrary message broadcast", async function () {
      const [owner] = await ethers.getSigners();
      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      const broadcastTx = await bridge.sendBroadcast(
        1, // Message ID
        false, // Request delivery receipt
        // @ts-ignore
        encodedMessage, // Message
        "0x" // Extra data
      );

      const tx = await broadcastTx.wait();

      expect(tx.events?.length).to.equal(1);

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(parseInt(e.args?.messageId)).to.equal(1);
        expect(e.args?.receipt).to.equal(false);
        // @ts-ignore
        expect(e.args?.message).to.equal(encodedMessage);
      });
    });

    it("Simulate receiving a message", async function () {
      const [owner] = await ethers.getSigners();
      const Bridge = await ethers.getContractFactory("BridgeDeployable");
      const bridge = await Bridge.deploy();
      await bridge.deployed();

      // Initialzie bridge
      await bridge.initialize(owner.address);

      // Create mock message receiver
      const mockReceiver = await deployMockContract(
        owner,
        IMessageReceiver.abi
      );

      await mockReceiver.mock.receiveBridgeMessage.returns(false);

      const relayTx = await bridge.relayMessage(
        mockReceiver.address, // Recipient
        1, // MessageId
        owner.address, // Sender
        100, // From network
        true, // Request receipt
        // @ts-ignore
        encodedMessage // Message
      );

      const tx = await relayTx.wait();

      expect(tx.events?.length).to.equal(1);

      await tx.events?.forEach((e) => {
        expect(e.args?.from).to.equal(owner.address);
        expect(e.args?.fromNetworkId).to.equal(100);
        expect(e.args?.receiver).to.equal(mockReceiver.address);
        expect(e.args?.success).to.equal(false);
        expect(e.args?.messageId).to.equal(1);
        expect(e.args?.receipt).to.equal(true);
      });
    });
  });
});
