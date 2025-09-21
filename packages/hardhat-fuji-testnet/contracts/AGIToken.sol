//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * AGI Token - The governance token for Avanguard Index platform
 * Fixed supply of 1 billion tokens, no minting after deployment
 * @author Avanguard Index
 */
contract AGIToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens with 18 decimals

    constructor(address initialOwner) ERC20("Avanguard Index", "AGI") Ownable(initialOwner) {
        _mint(initialOwner, TOTAL_SUPPLY);
    }

    /**
     * @dev Override to prevent minting after deployment
     */
    function mint(address to, uint256 amount) public pure {
        revert("Minting disabled after deployment");
    }

    /**
     * @dev Burn tokens from the caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burn tokens from a specific address (requires approval)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) public {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
    }
}
