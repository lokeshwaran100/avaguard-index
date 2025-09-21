//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IOracle.sol";
import "./IDEX.sol";

interface IWAVAX {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface IPangolinRouter {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    
    function getAmountsIn(uint amountOut, address[] calldata path)
        external
        view
        returns (uint[] memory amounts);
}

/**
 * Fund Contract - Manages individual index funds with weighted token allocations
 * @author Avanguard Index
 */
contract Fund is ERC20, Ownable {
    // Fund metadata
    string public fundName;
    string public fundTicker;
    address[] public underlyingTokens;
    address public creator;
    address public oracle;
    address public dex;
    address public wavax;

    
    // Token balance tracking
    mapping(address => uint256) public tokenBalances;
    
    // Token weightage tracking (in basis points, 100% = 10000)
    mapping(address => uint256) public tokenWeightages;
    uint256 public totalWeightage;
    
    // Fee structure (1% = 100 basis points)
    uint256 public constant FEE_BASIS_POINTS = 100; // 1%
    uint256 public constant BASIS_POINTS_DENOMINATOR = 10000;
    uint256 public constant SLIPPAGE_BUFFER_BASIS_POINTS = 200; // 2%
    
    // Fee distribution percentages
    uint256 public constant CREATOR_FEE_PERCENT = 50; // 50% to creator
    uint256 public constant AGI_BUYBACK_PERCENT = 25; // 25% to AGI buyback
    uint256 public constant TREASURY_PERCENT = 25;    // 25% to treasury
    
    // Treasury address
    address public treasury;
    
    // Events
    event FundTokenBought(address indexed buyer, uint256 avaxAmount, uint256 fundTokensMinted, uint256 feePaid);
    event FundTokenSold(address indexed seller, uint256 fundTokensBurned, uint256 avaxReturned, uint256 feePaid);
    event FeesDistributed(uint256 creatorFee, uint256 agiBuybackFee, uint256 treasuryFee);
    event WeightagesUpdated(address[] tokens, uint256[] weightages);
    
    constructor(
        string memory _fundName,
        string memory _fundTicker,
        address[] memory _underlyingTokens,
        uint256[] memory _tokenWeightages,
        address _creator,
        address _oracle,
        address _treasury,
        address _dex,
        address _wavax
    ) ERC20(_fundName, _fundTicker) Ownable(_creator) {
        require(_underlyingTokens.length == _tokenWeightages.length, "Tokens and weightages length mismatch");
        require(_underlyingTokens.length > 0, "Must have at least one token");
        
        fundName = _fundName;
        fundTicker = _fundTicker;
        underlyingTokens = _underlyingTokens;
        creator = _creator;
        oracle = _oracle;
        treasury = _treasury;
        dex = _dex;
        wavax = _wavax;
        
        // Set weightages and validate total is 100%
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < _underlyingTokens.length; i++) {
            require(_tokenWeightages[i] > 0, "Weightage must be greater than 0");
            tokenWeightages[_underlyingTokens[i]] = _tokenWeightages[i];
            totalWeight += _tokenWeightages[i];
        }
        require(totalWeight == BASIS_POINTS_DENOMINATOR, "Total weightage must be 100%");
        totalWeightage = totalWeight;
        
        _transferOwnership(_creator);
    }

    function swapExactTokensForTokens(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) internal returns (uint256 tokensOut) {
        require(dex != address(0), "DEX not set");
        require(amountIn > 0, "Amount must be > 0");

        IERC20(fromToken).approve(dex, amountIn);

        address[] memory path = new address[](2);
        path[0] = fromToken;
        path[1] = toToken;

        uint256 balanceBefore = IERC20(toToken).balanceOf(address(this));

        IPangolinRouter(dex).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            1, // amountOutMin (you can adjust for slippage)
            path,
            address(this),
            block.timestamp + 1200 // 20 minutes
        );

        uint256 balanceAfter = IERC20(toToken).balanceOf(address(this));
        tokensOut = balanceAfter - balanceBefore;
    }


    
    /**
     * @dev Buy fund tokens with AVAX
     */
    function buy() external payable {
        require(msg.value > 0, "Must send AVAX");
        require(underlyingTokens.length > 0, "No underlying tokens");
        
        uint256 fee = (msg.value * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 remainingAmount = msg.value - fee;
        
        // Calculate how many fund tokens to mint based on current fund value
        uint256 fundTokensToMint = calculateFundTokensToMint(remainingAmount);
        
        // Mint fund tokens to buyer
        _mint(msg.sender, fundTokensToMint);
        
        // Distribute fees
        distributeFees(fee);
        
        // Buy underlying tokens with remaining AVAX
        IWAVAX(wavax).deposit{value: remainingAmount}();
        buyUnderlyingTokens(IERC20(wavax).balanceOf(address(this)));
        
        emit FundTokenBought(msg.sender, msg.value, fundTokensToMint, fee);
    }



function buyUnderlyingTokens(uint256 wavaxAmount) internal {
    require(wavaxAmount > 0, "Amount must be greater than 0");
    require(dex != address(0), "DEX not set");

    uint256 amountPerToken = wavaxAmount / underlyingTokens.length;

    for (uint256 i = 0; i < underlyingTokens.length; i++) {
        address token = underlyingTokens[i];
        
        if (amountPerToken > 0) {
            address[] memory path = new address[](2);
            path[0] = wavax;
            path[1] = token;

            IERC20(wavax).approve(dex, amountPerToken);
            uint256 balanceBefore = IERC20(token).balanceOf(address(this));
            
            try IPangolinRouter(dex).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountPerToken,
                1, // amountOutMin
                path,
                address(this),
                block.timestamp + 1200
            ) {
                uint256 balanceAfter = IERC20(token).balanceOf(address(this));
                uint256 tokensReceived = balanceAfter - balanceBefore;
                tokenBalances[token] += tokensReceived;
            } catch {
                // If swap fails, just continue to the next token
                continue;
            }
        }
    }
}


    
function sellUnderlyingTokens(uint256 sellPercentage) internal returns (uint256 totalAvaxReceived) {
    require(dex != address(0), "DEX not set");
    require(sellPercentage > 0, "Sell percentage must be greater than 0");

    totalAvaxReceived = 0;

    for (uint256 i = 0; i < underlyingTokens.length; i++) {
        address token = underlyingTokens[i];
        uint256 tokenBalance = tokenBalances[token];

        if (tokenBalance > 0) {
            uint256 tokensToSell = (tokenBalance * sellPercentage) / 1e18;
            if (tokensToSell == 0) continue;

            address[] memory path = new address[](2);
            path[0] = token;
            path[1] = wavax;

            IERC20(token).approve(dex, tokensToSell);

            uint256 wavaxBefore = IERC20(wavax).balanceOf(address(this));

            IPangolinRouter(dex).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                tokensToSell,
                1, // amountOutMin
                path,
                address(this),
                block.timestamp + 1200
            );

            uint256 wavaxAfter = IERC20(wavax).balanceOf(address(this));
            uint256 wavaxReceived = wavaxAfter - wavaxBefore;

            if (wavaxReceived > 0) {
                IWAVAX(wavax).withdraw(wavaxReceived); // unwrap WAVAX → AVAX
                totalAvaxReceived += wavaxReceived;
                tokenBalances[token] -= tokensToSell;
            }
        }
    }

    return totalAvaxReceived;
}

    /**
     * @dev Sell fund tokens for AVAX
     * @param fundTokenAmount Amount of fund tokens to sell
     */
    function sell(uint256 fundTokenAmount) external {
        require(fundTokenAmount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= fundTokenAmount, "Insufficient fund tokens");
        require(totalSupply() > 0, "No fund tokens in circulation");
        
        // Calculate the percentage of fund tokens being sold
        uint256 sellPercentage = (fundTokenAmount * 1e18) / totalSupply(); // 18 decimals for precision
        
        // Sell underlying tokens proportionally and get total AVAX received
        uint256 totalAvaxReceived = sellUnderlyingTokens(sellPercentage);
        require(totalAvaxReceived > 0, "No value to return");
        
        // Calculate fee (1%)
        uint256 fee = (totalAvaxReceived * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint256 avaxToReturn = totalAvaxReceived - fee;
        
        // Burn fund tokens
        _burn(msg.sender, fundTokenAmount);
        
        // Distribute fees
        distributeFees(fee);
        
        // Transfer AVAX to seller
        (bool success, ) = payable(msg.sender).call{value: avaxToReturn}("");
        require(success, "Failed to transfer AVAX");
        
        emit FundTokenSold(msg.sender, fundTokenAmount, avaxToReturn, fee);
    }



// function swapTokensForAvax(address token, uint256 amount) internal returns (uint256 avaxReceived) {
//     require(dex != address(0), "DEX not set");

//     IERC20(token).approve(dex, amount);

//     address[] memory path = new address[](2);
//     path[0] = token;
//     path[1] = wavax;

//     uint256 balanceBefore = address(this).balance;

//     IPangolinRouter(dex).swapExactTokensForTokensSupportingFeeOnTransferTokens(
//         amount,
//         1,
//         path,
//         address(this),
//         block.timestamp + 1200
//     );

//     // unwrap WAVAX to AVAX
//     uint256 wavaxBalance = IERC20(wavax).balanceOf(address(this));
//     IWAVAX(wavax).withdraw(wavaxBalance);

//     uint256 balanceAfter = address(this).balance;
//     avaxReceived = balanceAfter - balanceBefore;
// }

//     /**
//      * @dev Swap AVAX for tokens using DEX
//      * @param token The token address to receive
//      * @param avaxAmount The amount of AVAX to swap
//      * @return tokensReceived The amount of tokens received
//      */
//     function swapAvaxForTokens(address token, uint256 avaxAmount) internal returns (uint256 tokensReceived) {
//         require(dex != address(0), "DEX not set");
//         require(avaxAmount > 0, "Amount must be greater than 0");
        
//         // Get the expected token output from DEX
//         uint256 expectedTokens = IDEX(dex).getAmountsOut(address(0), avaxAmount);
//         require(expectedTokens > 0, "No token value for AVAX");
        
//         // Call the DEX swap function with AVAX value
//         // Note: In a real implementation, this would require the contract to have AVAX balance
//         // For now, we'll simulate the swap by returning the expected value
//         // The actual DEX integration would be: IDEX(dex).swapExactAVAXForTokens{value: avaxAmount}(token, expectedTokens, address(this), block.timestamp)
//         tokensReceived = expectedTokens;
        
//         return tokensReceived;
//     }
    
    /**
     * @dev Get current fund value in AVAX
     * @return Total fund value in AVAX
     */
    function getCurrentFundValue() external view returns (uint256) {
        if (totalSupply() == 0) return 0;
        
        uint256 totalValue = 0;
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            address token = underlyingTokens[i];
            uint256 tokenBalance = tokenBalances[token];
            
            if (tokenBalance > 0) {
                // Convert token balance to AVAX value using oracle prices
                uint256 tokenPriceUSD = IOracle(oracle).getPrice(token);
                uint256 avaxPriceUSD = IOracle(oracle).getPrice(address(0));
                
                if (tokenPriceUSD > 0 && avaxPriceUSD > 0) {
                    // Calculate token value in USD
                    uint256 tokenValueUSD = (tokenBalance * tokenPriceUSD) / 1e8;
                    // Convert USD value to AVAX
                    uint256 tokenValueInAvax = (tokenValueUSD * 1e8) / avaxPriceUSD;
                    totalValue += tokenValueInAvax;
                } else {
                    // Fallback: use token balance as AVAX value
                    totalValue += tokenBalance;
                }
            }
        }
        return totalValue;
    }
    
    /**
     * @dev Get current fund value in USD
     * @return Total fund value in USD (18 decimals)
     */
    function getCurrentFundValueUSD() internal view returns (uint256) {
        if (totalSupply() == 0) return 0;
        
        uint256 totalValueUSD = 0;
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            address token = underlyingTokens[i];
            uint256 tokenBalance = tokenBalances[token];
            
            if (tokenBalance > 0) {
                uint256 tokenPriceUSD = IOracle(oracle).getPrice(token);
                // Calculate token value in USD
                uint256 tokenValueUSD = (tokenBalance * tokenPriceUSD) / 1e8;
                totalValueUSD += tokenValueUSD;
            }
        }
        return totalValueUSD;
    }
    
    /**
     * @dev Get fund token balance for a specific address
     * @param user Address to check balance for
     * @return Fund token balance
     */
    function fundTokenBalanceOf(address user) external view returns (uint256) {
        return balanceOf(user);
    }
    
    /**
     * @dev Calculate how many fund tokens to mint for given AVAX amount
     * @param avaxAmount Amount of AVAX to invest
     * @return Fund tokens to mint
     */
    function calculateFundTokensToMint(uint256 avaxAmount) internal view returns (uint256) {
        if (totalSupply() == 0) {
            // First investment - mint tokens 1:1 with avax amount
            return avaxAmount;
        }
        
        // Apply a buffer to the investment amount to account for potential slippage on asset purchase
        uint256 effectiveAvaxAmount = (avaxAmount * (BASIS_POINTS_DENOMINATOR - SLIPPAGE_BUFFER_BASIS_POINTS))
            / BASIS_POINTS_DENOMINATOR;

        // Get AVAX price in USD (8 decimals)
        uint256 avaxPriceUSD = IOracle(oracle).getPrice(address(0));
        
        // Convert AVAX amount to USD value (18 decimals for AVAX, 8 decimals for price)
        // avaxAmount * avaxPriceUSD / 10^8 = USD value with 18 decimals
        uint256 avaxValueUSD = (effectiveAvaxAmount * avaxPriceUSD) / 1e8;
        
        // Get current fund value in USD
        uint256 currentFundValueUSD = getCurrentFundValueUSD();
        
        // Calculate fund tokens to mint based on USD proportion
        // (avaxValueUSD * totalSupply) / currentFundValueUSD
        return (avaxValueUSD * totalSupply()) / currentFundValueUSD;
    }
    
    /**
     * @dev Calculate AVAX value for given fund token amount
     * @param fundTokenAmount Amount of fund tokens
     * @return AVAX value
     */
    function calculateAvaxValue(uint256 fundTokenAmount) internal view returns (uint256) {
        if (totalSupply() == 0) return 0;
        
        uint256 currentFundValue = this.getCurrentFundValue();
        return (fundTokenAmount * currentFundValue) / totalSupply();
    }
    
    /**
     * @dev Distribute fees to creator, AGI buyback, and treasury
     * @param totalFee Total fee amount to distribute
     */
    function distributeFees(uint256 totalFee) internal {
        uint256 creatorFee = (totalFee * CREATOR_FEE_PERCENT) / 100;
        uint256 agiBuybackFee = (totalFee * AGI_BUYBACK_PERCENT) / 100;
        uint256 treasuryFee = (totalFee * TREASURY_PERCENT) / 100;
        
        // Send to creator
        if (creatorFee > 0) {
            (bool success1, ) = payable(creator).call{value: creatorFee}("");
            require(success1, "Failed to send creator fee");
        }
        
        // Send to treasury (AGI buyback will be handled by treasury)
        if (agiBuybackFee + treasuryFee > 0) {
            (bool success2, ) = payable(treasury).call{value: agiBuybackFee + treasuryFee}("");
            require(success2, "Failed to send treasury fee");
        }
        
        emit FeesDistributed(creatorFee, agiBuybackFee, treasuryFee);
    }
    
    /**
     * @dev Get underlying tokens array
     * @return Array of underlying token addresses
     */
    function getUnderlyingTokens() external view returns (address[] memory) {
        return underlyingTokens;
    }
    
    /**
     * @dev Update treasury address (only owner)
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        treasury = newTreasury;
    }
    
    /**
     * @dev Update oracle address (only owner)
     * @param newOracle New oracle address
     */
    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        oracle = newOracle;
    }
    
    /**
     * @dev Update DEX address (only owner)
     * @param newDex New DEX address
     */
    function updateDex(address newDex) external onlyOwner {
        require(newDex != address(0), "Invalid DEX address");
        dex = newDex;
    }
    
    /**
     * @dev Rebalance fund by updating weightages and swapping tokens accordingly (only owner)
     * @param tokens Array of token addresses
     * @param weightages Array of weightages (in basis points)
     */
    function rebalance(address[] memory tokens, uint256[] memory weightages) external onlyOwner {
        require(tokens.length == weightages.length, "Tokens and weightages length mismatch");
        require(tokens.length > 0, "Must have at least one token");
        require(dex != address(0), "DEX not set");
        
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            require(weightages[i] > 0, "Weightage must be greater than 0");
            totalWeight += weightages[i];
        }
        require(totalWeight == BASIS_POINTS_DENOMINATOR, "Total weightage must be 100%");
        
        // Get current fund value in AVAX
        uint256 currentFundValue = this.getCurrentFundValue();
        require(currentFundValue > 0, "No fund value to rebalance");
        
        // Calculate target token balances based on new weightages
        uint256[] memory targetBalances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 targetValue = (currentFundValue * weightages[i]) / BASIS_POINTS_DENOMINATOR;
            
            // Convert AVAX value to token amount using oracle prices
            uint256 tokenPriceUSD = IOracle(oracle).getPrice(token);
            uint256 avaxPriceUSD = IOracle(oracle).getPrice(address(0));
            
            if (tokenPriceUSD > 0 && avaxPriceUSD > 0) {
                // Calculate token amount: (targetValue * avaxPriceUSD) / tokenPriceUSD
                targetBalances[i] = (targetValue * avaxPriceUSD) / tokenPriceUSD;
            } else {
                // Fallback: use target value directly
                targetBalances[i] = targetValue;
            }
        }
        
        // Perform rebalancing using IPangolinRouter
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 currentBalance = tokenBalances[token];
            uint256 targetBalance = targetBalances[i];
            
            if (currentBalance != targetBalance) {
                if (currentBalance > targetBalance) {
                    // Need to sell excess tokens
                    uint256 tokensToSell = currentBalance - targetBalance;
                    if (tokensToSell > 0) {
                        // Sell tokens for WAVAX
                        uint256 wavaxReceived = swapTokensForWavax(token, tokensToSell);
                        if (wavaxReceived > 0) {
                            // Update balance
                            tokenBalances[token] = targetBalance;
                        }
                    }
                } else if (targetBalance > currentBalance) {
                    // Need to buy more tokens
                    uint256 tokensToBuy = targetBalance - currentBalance;
                    if (tokensToBuy > 0) {
                        // Calculate WAVAX needed for the purchase
                        uint256 wavaxNeeded = calculateWavaxNeededForTokens(token, tokensToBuy);
                        if (wavaxNeeded > 0 && IERC20(wavax).balanceOf(address(this)) >= wavaxNeeded) {
                            // Buy tokens with WAVAX
                            uint256 tokensReceived = swapWavaxForTokens(token, wavaxNeeded);
                            if (tokensReceived > 0) {
                                // Update balance
                                tokenBalances[token] = currentBalance + tokensReceived;
                            }
                        }
                    }
                }
            }
        }
        
        // Update weightages in state
        for (uint256 i = 0; i < tokens.length; i++) {
            tokenWeightages[tokens[i]] = weightages[i];
        }
        totalWeightage = totalWeight;
        
        emit WeightagesUpdated(tokens, weightages);
    }
    
    /**
     * @dev Get token balance for a specific token
     * @param token The token address
     * @return balance The token balance
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return tokenBalances[token];
    }
    
    /**
     * @dev Get weightage for a specific token
     * @param token The token address
     * @return weightage The token weightage in basis points
     */
    function getTokenWeightage(address token) external view returns (uint256) {
        return tokenWeightages[token];
    }
    
    /**
     * @dev Get all token weightages
     * @return tokens Array of token addresses
     * @return weightages Array of corresponding weightages
     */
    function getAllTokenWeightages() external view returns (address[] memory tokens, uint256[] memory weightages) {
        tokens = underlyingTokens;
        weightages = new uint256[](underlyingTokens.length);
        
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            weightages[i] = tokenWeightages[underlyingTokens[i]];
        }
        
        return (tokens, weightages);
    }
    
    /**
     * @dev Get fund composition (tokens and their current balances)
     * @return tokens Array of token addresses
     * @return balances Array of corresponding balances
     * @return weightages Array of corresponding weightages
     */
    function getFundComposition() external view returns (
        address[] memory tokens,
        uint256[] memory balances,
        uint256[] memory weightages
    ) {
        tokens = underlyingTokens;
        balances = new uint256[](underlyingTokens.length);
        weightages = new uint256[](underlyingTokens.length);
        
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            balances[i] = tokenBalances[underlyingTokens[i]];
            weightages[i] = tokenWeightages[underlyingTokens[i]];
        }
        
        return (tokens, balances, weightages);
    }
    
    /**
     * @dev Validate that all weightages sum to 100%
     * @return isValid True if weightages are valid
     */
    function validateWeightages() external view returns (bool isValid) {
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            totalWeight += tokenWeightages[underlyingTokens[i]];
        }
        return totalWeight == BASIS_POINTS_DENOMINATOR;
    }
    
    /**
     * @dev Swap tokens for WAVAX using IPangolinRouter
     * @param token The token to sell
     * @param amount The amount of tokens to sell
     * @return wavaxReceived The amount of WAVAX received
     */
    function swapTokensForWavax(address token, uint256 amount) internal returns (uint256 wavaxReceived) {
        require(dex != address(0), "DEX not set");
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).approve(dex, amount);

        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = wavax;

        uint256 balanceBefore = IERC20(wavax).balanceOf(address(this));

        IPangolinRouter(dex).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amount,
            1, // amountOutMin
            path,
            address(this),
            block.timestamp + 1200
        );

        uint256 balanceAfter = IERC20(wavax).balanceOf(address(this));
        wavaxReceived = balanceAfter - balanceBefore;
    }

    /**
     * @dev Swap WAVAX for tokens using IPangolinRouter
     * @param token The token to buy
     * @param wavaxAmount The amount of WAVAX to spend
     * @return tokensReceived The amount of tokens received
     */
    function swapWavaxForTokens(address token, uint256 wavaxAmount) internal returns (uint256 tokensReceived) {
        require(dex != address(0), "DEX not set");
        require(wavaxAmount > 0, "Amount must be greater than 0");

        IERC20(wavax).approve(dex, wavaxAmount);

        address[] memory path = new address[](2);
        path[0] = wavax;
        path[1] = token;

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        IPangolinRouter(dex).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            wavaxAmount,
            1, // amountOutMin
            path,
            address(this),
            block.timestamp + 1200
        );

        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        tokensReceived = balanceAfter - balanceBefore;
    }

    /**
     * @dev Calculate WAVAX needed for a specific amount of tokens
     * @param token The token address
     * @param tokenAmount The amount of tokens needed
     * @return wavaxNeeded The amount of WAVAX needed
     */
    function calculateWavaxNeededForTokens(address token, uint256 tokenAmount) internal view returns (uint256 wavaxNeeded) {
        require(dex != address(0), "DEX not set");
        require(tokenAmount > 0, "Token amount must be greater than 0");

        address[] memory path = new address[](2);
        path[0] = wavax;
        path[1] = token;

        try IPangolinRouter(dex).getAmountsIn(tokenAmount, path) returns (uint[] memory amounts) {
            if (amounts.length > 0) {
                wavaxNeeded = amounts[0];
            }
        } catch {
            // If calculation fails, use oracle prices as fallback
            uint256 tokenPriceUSD = IOracle(oracle).getPrice(token);
            uint256 avaxPriceUSD = IOracle(oracle).getPrice(address(0));
            
            if (tokenPriceUSD > 0 && avaxPriceUSD > 0) {
                wavaxNeeded = (tokenAmount * tokenPriceUSD) / avaxPriceUSD;
            }
        }
    }

    /**
     * @dev Allow contract to receive AVAX
     */
    receive() external payable {}
}
