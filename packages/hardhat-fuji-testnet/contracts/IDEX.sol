//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * DEX Interface for swapping tokens and AVAX
 * @author Avanguard Index
 */
interface IDEX {
    /**
     * @dev Swap tokens for AVAX
     * @param tokenIn The token address to swap from
     * @param amountIn The amount of tokens to swap
     * @param amountOutMin The minimum amount of AVAX to receive
     * @param to The address to receive the AVAX
     * @param deadline The deadline for the swap
     * @return amountOut The amount of AVAX received
     */
    function swapExactTokensForAVAX(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
    
    /**
     * @dev Swap AVAX for tokens
     * @param tokenOut The token address to receive
     * @param amountOutMin The minimum amount of tokens to receive
     * @param to The address to receive the tokens
     * @param deadline The deadline for the swap
     * @return amountOut The amount of tokens received
     */
    function swapExactAVAXForTokens(
        address tokenOut,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountOut);
    
    /**
     * @dev Get the expected output amount for a swap
     * @param tokenIn The token address to swap from (address(0) for AVAX)
     * @param amountIn The amount to swap
     * @return amountOut The expected amount to receive
     */
    function getAmountsOut(address tokenIn, uint256 amountIn) external view returns (uint256 amountOut);
}
