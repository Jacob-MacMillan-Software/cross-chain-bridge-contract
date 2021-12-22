//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./TollBridge.sol";
import "hardhat/console.sol";

contract FeeVerifyTester is TollBridge {
	using ECDSAUpgradeable for bytes32;
	using ECDSAUpgradeable for bytes;

	function toString(address account) private pure returns(string memory) {
		return toString(abi.encodePacked(account));
	}

	function toString(uint256 value) private pure returns(string memory) {
		return toString(abi.encodePacked(value));
	}

	function toString(bytes32 value) private pure returns(string memory) {
		return toString(abi.encodePacked(value));
	}

	function toString(bytes memory data) private pure returns(string memory) {
		bytes memory alphabet = "0123456789abcdef";

		bytes memory str = new bytes(2 + data.length * 2);
		str[0] = "0";
		str[1] = "x";
		for (uint i = 0; i < data.length; i++) {
			str[2+i*2] = alphabet[uint(uint8(data[i] >> 4))];
			str[3+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
		}
		return string(str);
	}

	function testVerifyFee(
		bytes32 _hash,
		bytes calldata _signature,
		uint256 _destination,
		address _feeToken,
		uint256 _feeAmount,
		uint256 _maxBlock
	) external view returns (address) {
		console.log(toString(keccak256(abi.encode(
			_msgSender(),
			_destination,
			_feeToken,
			_feeAmount,
			_maxBlock
		))));

		bytes32 computedHash = keccak256(abi.encode(
			_msgSender(),
			_destination,
			_feeToken,
			_feeAmount,
			_maxBlock
		)).toEthSignedMessageHash();

		console.log(toString(computedHash));

		verifyFee(_hash, _signature, _destination, _feeToken, _feeAmount, _maxBlock);

		console.log(_hash.recover(_signature));

		return _hash.recover(_signature);
	}
}
