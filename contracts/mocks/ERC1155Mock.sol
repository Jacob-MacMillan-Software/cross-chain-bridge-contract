// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

contract ERC1155Mock is ERC1155Upgradeable {
	// No point in making this upgradeable
	constructor(string memory uri) {
		__ERC1155_init(uri);
	}

	function setURI(string memory newuri) public {
		_setURI(newuri);
	}

	function mint(
		address to,
		uint256 id,
		uint256 value,
		bytes memory data
	) public {
		_mint(to, id, value, data);
	}

	function mintBatch(
		address to,
		uint256[] memory ids,
		uint256[] memory values,
		bytes memory data
	) public {
		_mintBatch(to, ids, values, data);
	}

	function burn(
		address owner,
		uint256 id,
		uint256 value
	) public {
		_burn(owner, id, value);
	}

	function burnBatch(
		address owner,
		uint256[] memory ids,
		uint256[] memory values
	) public {
		_burnBatch(owner, ids, values);
	}
}
