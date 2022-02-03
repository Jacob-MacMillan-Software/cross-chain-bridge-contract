//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Bridge.sol";

contract BridgeDeployable is Bridge {
	function initialize(address _controller, uint256 _chainId) public virtual initializer {
		Bridge.__init_bridge(_controller, _chainId);
	}
}
