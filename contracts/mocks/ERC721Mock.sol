// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract ERC721Mock is ERC721Upgradeable {
	// no point in making upgradeable
	constructor(string memory name, string memory symbol) initializer {
		__ERC721_init(name, symbol);
	}

	function baseURI() public view returns (string memory) {
		return _baseURI();
	}

	function exists(uint256 tokenId) public view returns (bool) {
		return _exists(tokenId);
	}

	function mint(address to, uint256 tokenId) public {
		_mint(to, tokenId);
	}

	function safeMint(address to, uint256 tokenId) public {
		_safeMint(to, tokenId);
	}

	function safeMint(
		address to,
		uint256 tokenId,
		bytes memory _data
	) public {
		_safeMint(to, tokenId, _data);
	}

	function burn(uint256 tokenId) public {
		_burn(tokenId);
	}
}
