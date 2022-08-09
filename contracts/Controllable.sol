//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Controllable is OwnableUpgradeable {
	// Errors
	error ControllerOnly();

	mapping (address => bool) private controllers;

	modifier onlyController {
		if(!controllers[_msgSender()] && _msgSender() != owner()) revert ControllerOnly();
		_;
	}

	function __init_controller(address _controller) internal virtual onlyInitializing {
		controllers[_controller] = true;
		__Ownable_init();
	}

	function changeController(address _controller, bool _allow) external onlyController {
		require(_controller != address(0), "Controller cannot be 0 address");
		controllers[_controller] = _allow;
	}

	function isController(address _controller) public view returns (bool) {
		return controllers[_controller];
	}
}
