//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Controllable is OwnableUpgradeable {
	address private controller;

	modifier onlyController {
		require(_msgSender() == controller || _msgSender() == owner(), "Controllable: only controller");
		_;
	}

	function __init_controller(address _controller) internal virtual onlyInitializing {
		controller = _controller;
		__Ownable_init();
	}

	function changeController(address _controller) external onlyOwner {
		require(_controller != address(0), "Controller cannot be 0 address");
		controller = _controller;
	}
}
