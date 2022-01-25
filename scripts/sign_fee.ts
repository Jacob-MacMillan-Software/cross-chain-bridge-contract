import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
// import { Contract } from "ethers";
// eslint-disable-next-line node/no-missing-import
import { generateFeeData } from "../test/helpers/messageSigning";

const zeroAddress = "0x0000000000000000000000000000000000000000";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const owner = new ethers.Wallet("0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d");

  const feeData = await generateFeeData(
    owner.address,
    100,
    zeroAddress,
    100,
    99999999999,
    {
      tokenAddr: "0x9b1f7F645351AF3631a656421eD2e40f2802E6c0",
      tokenId: 1,
    },
    null,
    false,
    owner,
    1
  );

  console.log("genereated fee data:", feeData);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
