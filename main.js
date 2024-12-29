import { Web3 } from "web3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import axios from "axios";
import inquirer from "inquirer";
import terminalLink from "terminal-link";
import displayBanner from "./config/banner.js";
import { ColorTheme } from "./config/colors.js";
import CountdownTimer from "./config/countdown.js";
import { logger } from "./config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NETWORKS = {
  BASE: {
    name: "Base",
    RPC_URL: "https://mainnet.base.org",
    CHAIN_ID: 8453,
    CONTRACT_ADDRESS: "0xC5bf05cD32a14BFfb705Fb37a9d218895187376c",
    EXPLORER_URL: "https://basescan.org",
    DEFAULT_AMOUNT: "0.0000000000001",
  },
  POLYGON: {
    name: "Polygon",
    RPC_URL: "https://polygon-rpc.com",
    CHAIN_ID: 137,
    CONTRACT_ADDRESS: "0xC5bf05cD32a14BFfb705Fb37a9d218895187376c",
    EXPLORER_URL: "https://polygonscan.com",
    GAS_PRICE: "0.00000003",
    DEFAULT_AMOUNT: "0.0000000000001",
  },
};

const FILES = {
  PRIVATE_KEYS_FILE: path.join(__dirname, "data.txt"),
  REFRESH_TOKENS_FILE: path.join(__dirname, "token.txt"),
};

const API = {
  GRAPHQL_URL:
    "https://hanafuda-backend-app-520478841386.us-central1.run.app/graphql",
  REFRESH_URL:
    "https://securetoken.googleapis.com/v1/token?key=AIzaSyDipzN0VRfTPnMGhQ5PSzO27Cxm3DohJGY",
  HEADERS: {
    Accept: "*/*",
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  },
};

const TRANSACTION = {
  MAX_RETRIES: 4,
  RETRY_DELAY: 5000,
  COUNTDOWN_DELAY: 5,
};

const GROW_LIMITS = [
  { min: 1, max: 1, grow: 10 },
  { min: 2, max: 2, grow: 11 },
  { min: 3, max: 3, grow: 12 },
  { min: 4, max: 4, grow: 13 },
  { min: 5, max: 5, grow: 20 },
  { min: 6, max: 6, grow: 21 },
  { min: 7, max: 7, grow: 22 },
  { min: 8, max: 8, grow: 23 },
  { min: 9, max: 9, grow: 24 },
  { min: 10, max: 19, grow: 30 },
  { min: 20, max: 29, grow: 40 },
  { min: 30, max: 49, grow: 50 },
  { min: 50, max: 99, grow: 75 },
  { min: 100, max: 999, grow: 100 },
  { min: 1000, max: 4999, grow: 200 },
  { min: 5000, max: Infinity, grow: 300 },
];

const CONTRACT_ABI = [
  {
    constant: false,
    inputs: [],
    name: "depositETH",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
];

const GRAPHQL_QUERIES = {
  GET_USER_INFO: `
    query getCurrentUser {
      currentUser {
        id
        totalPoint
        depositCount
      }
      getGardenForCurrentUser {
        gardenStatus {
          growActionCount
          gardenRewardActionCount
        }
      }
    }
  `,
  GROW_ACTION: `
    mutation executeGrowAction {
      executeGrowAction(withAll: true) {
        totalValue
        multiplyRate
      }
      executeSnsShare(actionType: GROW, snsType: X) {
        bonus
      }
    }
  `,
  GARDEN_ACTION: `
    mutation executeGardenRewardAction($limit: Int!) {
      executeGardenRewardAction(limit: $limit) {
        data {
          cardId
          group
        }
        isNew
      }
    }
  `,
  SYNC_ETH_TX: `
    mutation SyncEthereumTx($chainId: Int!, $txHash: String!) {
      syncEthereumTx(chainId: $chainId, txHash: $txHash)
    }`,
  GET_DEPOSIT_REWARD_RULES: `
    query getDepositRewardRules {
      masterData {
        depositReward {
          regular {
            value
            reward {
              drawCount
            }
          }
          milestone {
            value
            reward {
              drawCount
            }
          }
        }
      }
    }
  `,
};

class HanafudaClient {
  constructor() {
    this.colors = new ColorTheme();
    this.selectedNetwork = null;
  }

  initializeWeb3() {
    if (!this.selectedNetwork) {
      throw new Error("Network not selected");
    }
    this.web3 = new Web3(this.selectedNetwork.RPC_URL);
    this.contract = new this.web3.eth.Contract(
      CONTRACT_ABI,
      this.selectedNetwork.CONTRACT_ADDRESS
    );
  }

  async findOptimalGasPrice() {
    try {
      // Get current network conditions
      const latestBlock = await this.web3.eth.getBlock("latest");
      const baseFee = BigInt(
        latestBlock.baseFeePerGas || (await this.web3.eth.getGasPrice())
      );
      const currentGasPrice = BigInt(await this.web3.eth.getGasPrice());

      // Convert to Gwei for display only
      const baseFeeGwei = parseFloat(
        this.web3.utils.fromWei(baseFee.toString(), "gwei")
      );
      const currentGasPriceGwei = parseFloat(
        this.web3.utils.fromWei(currentGasPrice.toString(), "gwei")
      );

      // Use max between baseFee and current gas price, add 10% priority fee
      // Convert to number first for Math.max, then back to BigInt
      const baseGasPrice =
        baseFee > currentGasPrice ? baseFee : currentGasPrice;
      const priorityFee = (baseGasPrice * BigInt(10)) / BigInt(100); // 10% increase
      const optimalGasPrice = baseGasPrice + priorityFee;

      logger.info(
        this.colors.style(
          `Network Base Fee: ${baseFeeGwei.toFixed(2)} Gwei, ` +
            `Current Gas Price: ${currentGasPriceGwei.toFixed(2)} Gwei`,
          "info"
        )
      );

      return optimalGasPrice.toString();
    } catch (error) {
      logger.warn(
        this.colors.style(
          `Error getting network gas price: ${error.message}. Using increased fallback.`,
          "warning"
        )
      );
      // Add 10% to fallback gas price
      const fallbackGas = BigInt(await this.web3.eth.getGasPrice());
      const increasedGas =
        fallbackGas + (fallbackGas * BigInt(10)) / BigInt(100);
      return increasedGas.toString();
    }
  }

  async waitForLowerFee(gasLimit) {
    try {
      // Get network suggested gas price
      const gasPrice = BigInt(await this.findOptimalGasPrice());

      // Calculate fee
      const txnFeeWei = gasPrice * BigInt(gasLimit);
      const txnFeeEther = this.web3.utils.fromWei(
        txnFeeWei.toString(),
        "ether"
      );
      const gasPriceGwei = parseFloat(
        this.web3.utils.fromWei(gasPrice.toString(), "gwei")
      );

      logger.info(
        this.colors.style(
          `Current Network Gas Price: ${gasPriceGwei.toFixed(2)} Gwei - ` +
            `Estimated Fee: ${txnFeeEther} ${
              this.selectedNetwork.name === "Polygon" ? "POL" : "ETH"
            }`,
          "info"
        )
      );

      return gasPrice.toString();
    } catch (error) {
      logger.error(
        this.colors.style(`Error checking gas price: ${error.message}`, "error")
      );
      // Return current gas price as fallback
      return (await this.web3.eth.getGasPrice()).toString();
    }
  }

  formatPrivateKey(privateKey) {
    const trimmed = privateKey.trim();
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  }

  formatTxUrl(txHash) {
    const cleanHash = txHash.replace("0x", "");
    const baseUrl = this.selectedNetwork.EXPLORER_URL;
    const fullUrl = `${baseUrl}/tx/0x${cleanHash}#eventlog`;
    const shortHash = `${cleanHash.slice(0, 6)}...${cleanHash.slice(-4)}`;
    return terminalLink(shortHash, fullUrl);
  }

  formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  async getMaximumGrow(deposits) {
    const limit = GROW_LIMITS.find(
      (limit) => deposits >= limit.min && deposits <= limit.max
    );
    return limit ? limit.grow : 0;
  }

  async getNextMilestone(deposit, headers) {
    try {
      const response = await axios.post(
        API.GRAPHQL_URL,
        {
          query: GRAPHQL_QUERIES.GET_DEPOSIT_REWARD_RULES,
          operationName: "getDepositRewardRules",
        },
        { headers }
      );

      const milestones = response.data.data.masterData.depositReward.milestone;
      const nextMilestone = milestones.find((m) => m.value > deposit);

      if (nextMilestone) {
        const remaining = nextMilestone.value - deposit;
        logger.info(
          `${this.colors.style("Next Milestone", "label")}: ${this.colors.style(
            nextMilestone.value,
            "value"
          )} ` +
            `(${this.colors.style(remaining, "value")} deposits remaining) ` +
            `Reward: ${this.colors.style(
              nextMilestone.reward.drawCount + " draws",
              "value"
            )}`
        );
      } else {
        const lastMilestone = milestones[milestones.length - 1];
        logger.success(
          this.colors.style(
            `Maximum milestone (${lastMilestone.value}) achieved!`,
            "complete"
          )
        );
      }
    } catch (error) {
      logger.error(
        this.colors.style(
          "Failed to fetch milestone info: " + error.message,
          "failed"
        )
      );
    }
  }

  readPrivateKeys() {
    try {
      const privateKeys = fs
        .readFileSync(FILES.PRIVATE_KEYS_FILE, "utf8")
        .replace(/\r/g, "")
        .split("\n")
        .map((key) => key.trim())
        .filter(Boolean);

      const wallets = privateKeys
        .map((privateKey) => {
          const formattedKey = this.formatPrivateKey(privateKey);
          try {
            const account =
              this.web3.eth.accounts.privateKeyToAccount(formattedKey);
            return {
              address: account.address,
              privateKey: formattedKey,
            };
          } catch (err) {
            logger.error(
              this.colors.style(
                `Invalid private key found: ${this.formatAddress(privateKey)}`,
                "error"
              )
            );
            return null;
          }
        })
        .filter(Boolean);

      logger.info(
        this.colors.style(
          `Successfully loaded ${wallets.length} wallets`,
          "accountInfo"
        )
      );
      return wallets;
    } catch (error) {
      logger.error(
        this.colors.style(
          "Failed to read private keys: " + error.message,
          "error"
        )
      );
      process.exit(1);
    }
  }

  readRefreshTokens() {
    try {
      const data = fs
        .readFileSync(FILES.REFRESH_TOKENS_FILE, "utf8")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      logger.info(
        this.colors.style(
          `Successfully loaded ${data.length} refresh tokens`,
          "accountInfo"
        )
      );
      return data;
    } catch (error) {
      logger.error(
        this.colors.style(
          "Failed to read refresh tokens: " + error.message,
          "error"
        )
      );
      process.exit(1);
    }
  }

  async refreshTokenHandler(refreshToken) {
    logger.info(
      this.colors.style("Attempting to refresh token...", "progress")
    );
    try {
      const response = await axios.post(
        API.REFRESH_URL,
        `grant_type=refresh_token&refresh_token=${refreshToken}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      logger.success(
        this.colors.style("Token refreshed successfully", "complete")
      );
      return `Bearer ${response.data.access_token}`;
    } catch (error) {
      logger.error(
        this.colors.style("Token refresh failed: " + error.message, "failed")
      );
      return false;
    }
  }

  async syncTransaction(txHash, refreshToken) {
    let authToken = await this.refreshTokenHandler(refreshToken);
    const SYNC_DELAY = 2000; // Delay 2 detik antara retry
    const MAX_SYNC_RETRIES = 10; // Menambah jumlah retry maksimum

    // Tambah delay awal untuk memberikan waktu backend memproses
    await new Promise((resolve) => setTimeout(resolve, 3000));

    for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
      try {
        const response = await axios.post(
          API.GRAPHQL_URL,
          {
            query: GRAPHQL_QUERIES.SYNC_ETH_TX,
            variables: {
              chainId: this.selectedNetwork.CHAIN_ID,
              txHash: txHash,
            },
            operationName: "SyncEthereumTx",
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: authToken,
            },
            timeout: 30000, // Menambah timeout ke 30 detik
          }
        );

        if (response.data?.data?.syncEthereumTx) {
          logger.success(
            this.colors.style(
              `Transaction ${this.colors.style(
                this.formatTxUrl(txHash),
                "link"
              )} synced with backend`,
              "txSuccess"
            )
          );
          break;
        } else {
          throw new Error(`Sync unsuccessful`);
        }
      } catch (error) {
        logger.warn(
          this.colors.style(
            `Attempt ${attempt} - Sync failed for ${this.formatTxUrl(
              txHash
            )}: ${error.message}`,
            "warning"
          )
        );

        // Refresh token setiap 3 attempt
        if (attempt % 3 === 0) {
          logger.info(
            this.colors.style(
              `Attempting token refresh on attempt ${attempt}`,
              "progress"
            )
          );
          authToken = await this.refreshTokenHandler(refreshToken);
          if (authToken) {
            logger.success(
              this.colors.style("Token refreshed, retrying sync", "complete")
            );
            continue;
          }
        }

        if (attempt < MAX_SYNC_RETRIES) {
          // Menggunakan exponential backoff untuk delay
          const delay = SYNC_DELAY * Math.pow(1.5, attempt - 1);
          logger.info(
            this.colors.style(
              `Waiting ${(delay / 1000).toFixed(1)} seconds before retry...`,
              "waiting"
            )
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  async executeTransactions(privateKey, numTx, amountInEther, refreshToken) {
    try {
      const amountInWei = this.web3.utils.toWei(amountInEther, "ether");
      const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
      this.web3.eth.accounts.wallet.add(account);
      const fromAddress = account.address;

      for (let i = 0; i < numTx; i++) {
        try {
          await this.processSingleTransaction(
            fromAddress,
            privateKey,
            amountInWei,
            i,
            numTx,
            refreshToken
          );
        } catch (txError) {
          logger.error(
            this.colors.style(
              `Transaction ${i + 1} failed: ${txError.message}`,
              "txFailed"
            )
          );
          logger.info(this.colors.style("Retrying transaction...", "progress"));
          i--;
          await new Promise((resolve) =>
            setTimeout(resolve, TRANSACTION.RETRY_DELAY)
          );
        }
      }

      logger.success(
        this.colors.style(
          `Completed all transactions for ${this.formatAddress(fromAddress)}`,
          "complete"
        )
      );
    } catch (error) {
      logger.error(
        this.colors.style(
          `Wallet transaction execution failed: ${error.message}`,
          "failed"
        )
      );
    }
  }

  async processSingleTransaction(
    fromAddress,
    privateKey,
    amountInWei,
    index,
    total,
    refreshToken
  ) {
    const currentNonce = await this.web3.eth.getTransactionCount(
      fromAddress,
      "pending"
    );
    const gasLimit = await this.contract.methods
      .depositETH()
      .estimateGas({ from: fromAddress, value: amountInWei });

    const gasPrice = await this.waitForLowerFee(gasLimit);

    const tx = {
      from: fromAddress,
      to: this.selectedNetwork.CONTRACT_ADDRESS,
      value: amountInWei,
      gas: gasLimit,
      gasPrice: gasPrice,
      nonce: currentNonce,
      data: this.contract.methods.depositETH().encodeABI(),
    };

    logger.info(
      this.colors.style(
        `Sending transaction ${index + 1}/${total}...`,
        "txPending"
      )
    );

    const signedTx = await this.web3.eth.accounts.signTransaction(
      tx,
      privateKey
    );
    const receipt = await this.web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );

    logger.success(
      this.colors.style(
        `Transaction ${index + 1} successful: ` +
          `${this.colors.style(
            this.formatTxUrl(receipt.transactionHash),
            "link"
          )}`,
        "txSuccess"
      )
    );

    await this.syncTransaction(receipt.transactionHash, refreshToken);

    if (index < total - 1) {
      await CountdownTimer.countdown(TRANSACTION.COUNTDOWN_DELAY, {
        message: this.colors.style("Next transaction in: ", "timerCount"),
        format: "ss",
      });
    }
  }

  async handleGrowAndGarden(refreshToken) {
    try {
      const accessToken = await this.refreshTokenHandler(refreshToken);
      const headers = {
        ...API.HEADERS,
        Authorization: accessToken,
      };

      const infoResponse = await axios.post(
        API.GRAPHQL_URL,
        {
          query: GRAPHQL_QUERIES.GET_USER_INFO,
          operationName: "getCurrentUser",
        },
        { headers }
      );

      const userData = infoResponse.data.data;
      const balance = userData.currentUser.totalPoint;
      const deposit = userData.currentUser.depositCount;
      const grow =
        userData.getGardenForCurrentUser.gardenStatus.growActionCount;
      const garden =
        userData.getGardenForCurrentUser.gardenStatus.gardenRewardActionCount;

      // Get maximum possible grow
      const maxGrow = await this.getMaximumGrow(deposit);

      logger.info(
        `${this.colors.style("Points", "label")}: ${this.colors.style(
          balance.toLocaleString(),
          "value"
        )}`
      );
      logger.info(
        `${this.colors.style("Deposits", "label")}: ${this.colors.style(
          deposit.toString(),
          "value"
        )}`
      );
      logger.info(
        `${this.colors.style("Grow", "label")}: ${this.colors.style(
          grow.toString(),
          "value"
        )} / ${this.colors.style(maxGrow.toString(), "value")}`
      );
      logger.info(
        `${this.colors.style("Garden", "label")}: ${this.colors.style(
          garden.toString(),
          "value"
        )}`
      );

      await this.getNextMilestone(deposit, headers);

      if (grow > 0) {
        const reward = await this.executeGrowAction(headers);
        if (reward) {
          const newBalance = balance + reward;
          logger.success(
            `${this.colors.style("Reward", "label")}: ${this.colors.style(
              reward.toLocaleString(),
              "value"
            )}`
          );
          logger.success(
            `${this.colors.style("New Balance", "label")}: ${this.colors.style(
              newBalance.toLocaleString(),
              "value"
            )}`
          );
        }
      }

      await this.processGardenRewards(garden, headers);
    } catch (error) {
      logger.error(
        this.colors.style(
          "Handle grow and garden failed: " + error.message,
          "failed"
        )
      );
    }
  }

  async executeGrowAction(headers) {
    try {
      const growResponse = await axios.post(
        API.GRAPHQL_URL,
        {
          query: GRAPHQL_QUERIES.GROW_ACTION,
          operationName: "executeGrowAction",
        },
        { headers }
      );

      if (growResponse.data?.data?.executeGrowAction) {
        return growResponse.data.data.executeGrowAction.totalValue;
      }
      return 0;
    } catch (error) {
      logger.error(
        this.colors.style("Grow action failed: " + error.message, "failed")
      );
      return 0;
    }
  }

  async processGardenRewards(garden, headers) {
    while (garden > 0) {
      try {
        const limit = Math.min(garden, 10);

        const gardenResponse = await axios.post(
          API.GRAPHQL_URL,
          {
            query: GRAPHQL_QUERIES.GARDEN_ACTION,
            variables: { limit },
            operationName: "executeGardenRewardAction",
          },
          { headers }
        );

        const cardIds = gardenResponse.data.data.executeGardenRewardAction.map(
          (item) => item.data.cardId
        );

        logger.success(
          this.colors.style(
            `Opened Cards: ${this.colors.style(cardIds.join(", "), "value")}`,
            "complete"
          )
        );
        garden -= limit;
      } catch (error) {
        logger.error(
          this.colors.style("Garden action failed: " + error.message, "failed")
        );
        break;
      }
    }
  }

  async promptTransactionDetails() {
    const answers = await inquirer.prompt([
      {
        type: "number",
        name: "numTx",
        message: this.colors.style(
          "Enter number of transactions:",
          "menuTitle"
        ),
        validate: (value) => {
          if (value > 0) return true;
          return this.colors.style(
            "Please enter a number greater than 0",
            "error"
          );
        },
      },
      {
        type: "confirm",
        name: "useDefault",
        message: this.colors.style(
          `Use default amount of ${this.selectedNetwork.DEFAULT_AMOUNT} ${
            this.selectedNetwork.name === "Polygon" ? "POL" : "ETH"
          }?`,
          "menuTitle"
        ),
        default: true,
      },
      {
        type: "number",
        name: "customAmount",
        message: this.colors.style(
          `Enter ${
            this.selectedNetwork.name === "Polygon" ? "POL" : "ETH"
          } amount to send:`,
          "menuTitle"
        ),
        when: (answers) => !answers.useDefault,
        validate: (value) => {
          if (value > 0) return true;
          return this.colors.style(
            "Please enter a valid amount greater than 0",
            "error"
          );
        },
      },
    ]);

    const wallets = this.readPrivateKeys();
    const refreshTokens = this.readRefreshTokens();

    return {
      numTx: answers.numTx,
      amountInEther: answers.useDefault
        ? this.selectedNetwork.DEFAULT_AMOUNT
        : answers.customAmount.toString(),
      wallets,
      refreshTokens,
    };
  }

  async promptNetwork() {
    const { network } = await inquirer.prompt([
      {
        type: "list",
        name: "network",
        message: this.colors.style("Select network:", "menuTitle"),
        choices: [
          {
            name: this.colors.style(
              `${NETWORKS.BASE.name} Network`,
              "menuOption"
            ),
            value: NETWORKS.BASE,
          },
          {
            name: this.colors.style(
              `${NETWORKS.POLYGON.name} Network`,
              "menuOption"
            ),
            value: NETWORKS.POLYGON,
          },
        ],
      },
    ]);
    this.selectedNetwork = network;
    console.log(
      this.colors.style(
        `Selected network: ${this.selectedNetwork.name}`,
        "networkInfo"
      )
    );
  }

  async promptMode() {
    const { mode } = await inquirer.prompt([
      {
        type: "list",
        name: "mode",
        message: this.colors.style("Choose operation mode:", "menuTitle"),
        choices: [
          {
            name: this.colors.style("Execute Transactions", "menuOption"),
            value: "1",
          },
          {
            name: this.colors.style("Grow and Garden", "menuOption"),
            value: "2",
          },
        ],
      },
    ]);
    return mode;
  }

  async handleTransactionMode() {
    const { numTx, amountInEther, wallets, refreshTokens } =
      await this.promptTransactionDetails();

    if (wallets.length === 0) {
      logger.error(
        this.colors.style("No private keys found in data.txt", "error")
      );
      process.exit(1);
    }

    if (refreshTokens.length === 0) {
      logger.error(
        this.colors.style("No refresh tokens found in token.txt", "error")
      );
      process.exit(1);
    }

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      const refreshToken = refreshTokens[i % refreshTokens.length];

      logger.info(
        this.colors.style(
          `Processing wallet: ${this.formatAddress(wallet.address)}`,
          "accountInfo"
        )
      );
      await this.executeTransactions(
        wallet.privateKey,
        numTx,
        amountInEther,
        refreshToken
      );
    }

    logger.success(this.colors.style("All wallets processed", "complete"));
  }

  async handleGrowGardenMode() {
    const { autoRepeat } = await inquirer.prompt([
      {
        type: "confirm",
        name: "autoRepeat",
        message: this.colors.style(
          "Auto repeat process every 15 minutes?",
          "menuTitle"
        ),
        default: true,
      },
    ]);

    const refreshTokens = this.readRefreshTokens();

    if (refreshTokens.length === 0) {
      logger.error(
        this.colors.style("No refresh tokens found in token.txt", "error")
      );
      process.exit(1);
    }

    const processAccounts = async () => {
      for (const refreshToken of refreshTokens) {
        await this.handleGrowAndGarden(refreshToken);
      }
    };

    if (autoRepeat) {
      while (true) {
        await processAccounts();
        logger.info(
          this.colors.style(
            "All accounts processed. Starting cooldown...",
            "waiting"
          )
        );

        const minutes = 15;
        const totalSeconds = minutes * 60;

        process.stdout.write;
        for (let i = totalSeconds; i > 0; i--) {
          const mins = Math.floor(i / 60);
          const secs = i % 60;
          process.stdout.write(
            `\r${this.colors.style("Cooldown", "label")}: ${this.colors.style(
              `${mins.toString().padStart(2, "0")}:${secs
                .toString()
                .padStart(2, "0")}`,
              "value"
            )}`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        process.stdout.write("\r" + " ".repeat(50) + "\r");
      }
    } else {
      await processAccounts();
      logger.success(
        this.colors.style("One-time processing completed.", "complete")
      );
    }
  }

  async run() {
    try {
      displayBanner();

      await this.promptNetwork();
      this.initializeWeb3();

      const mode = await this.promptMode();

      switch (mode) {
        case "1":
          await this.handleTransactionMode();
          break;
        case "2":
          await this.handleGrowGardenMode();
          break;
        default:
          logger.error(this.colors.style("Invalid mode selected", "error"));
          process.exit(1);
      }
    } catch (error) {
      logger.error(
        this.colors.style("Application error: " + error.message, "error")
      );
    }
  }
}

process.on("unhandledRejection", (error) => {
  logger.error(
    this.colors.style(`Unhandled promise rejection: ${error.message}`, "error")
  );
  process.exit(1);
});

const client = new HanafudaClient();
client.run().catch((error) => {
  logger.error(this.colors.style("Fatal error: " + error.message, "error"));
  process.exit(1);
});
