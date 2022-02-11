// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const [owner] = await ethers.getSigners();

  const ERC20 = await ethers.getContractFactory("ERC20Mock");
  const erc20 = await ERC20.deploy("TST", "Test ERC-20");
  await erc20.deployed();

  console.log("ERC-20 deployed to:", erc20.address, "by", owner.address);

  const ERC721 = await ethers.getContractFactory("ERC721Mock");
  const erc721 = await ERC721.deploy("TST", "Test ERC-721");
  await erc721.deployed();

  console.log("ERC-721 deployed to:", erc721.address, "by", owner.address);

  const ERC1155 = await ethers.getContractFactory("ERC1155Mock");
  const erc1155 = await ERC1155.deploy(
    "https://thefabled-stuff.s3.amazonaws.com/"
  );
  await erc1155.deployed();

  console.log("ERC-1155 deployed to:", erc1155.address, "by", owner.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
