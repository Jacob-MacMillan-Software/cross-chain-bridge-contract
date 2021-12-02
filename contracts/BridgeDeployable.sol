//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./Bridge.sol";

contract BridgeDeployable is Bridge {
	function initialize(address _controller) public virtual initializer {
		Bridge.__init_bridge(_controller);
	}
}
