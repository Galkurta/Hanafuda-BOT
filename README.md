# Hanafuda Automation Tool

This is an automation tool for interacting with the Hanafuda platform on the Base network. The tool provides automated functionality for deposits, grow actions, and garden rewards.

## Features

- Automated ETH deposits with gas fee optimization
- Auto grow and garden reward collection
- Milestone tracking and reward monitoring
- Multi-wallet support
- Token refresh handling
- Customizable transaction parameters

## Prerequisites

- Node.js v18 or higher
- Base network wallet with ETH Base
- Hanafuda account (register at [Hanafuda Dashboard](https://hanafuda.hana.network/dashboard))

## Registration and Token Setup

1. Visit [Hanafuda Dashboard](https://hanafuda.hana.network/dashboard)
2. Click on "Register"
3. Use the invitation code: `QIV4XR`
4. Complete the registration process

### Getting Your Refresh Token

1. Go to the [Hanafuda Dashboard](https://hanafuda.hana.network/dashboard)
2. Open Developer Tools (F12 or Right Click -> Inspect)
3. Navigate to the "Application" tab
4. In the left sidebar, expand "Storage" and click "Session Storage"
5. Look for `https://hanafuda.hana.network`
6. Find the refresh token in the storage items
7. Copy the refresh token value and save it for configuration

## Installation

1. Clone this repository:

```bash
git clone https://github.com/Galkurta/Hanafuda-BOT.git
cd Hanafuda-BOT
```

2. Install dependencies:

```bash
npm install
```

3. Set up your configuration files:
   - Edit `data.txt` for private keys (one per line)
   - Edit `token.txt` for refresh tokens (one per line)

## Configuration Files

### data.txt

```
your_private_key_1
your_private_key_2
...
```

### token.txt

```
your_refresh_token_1
your_refresh_token_2
...
```

## Usage

Start the application:

```bash
node main.js
```

### Operation Modes

1. **Execute Transactions**

   - Automated ETH deposits
   - Configurable transaction count
   - Gas fee optimization

2. **Grow and Garden**
   - Auto-collect grow rewards
   - Process garden rewards
   - Auto-repeat every 15 minutes (optional)
   - Milestone tracking

## Milestone Rewards

The platform offers milestone rewards for deposit counts:

- Regular: 1 draw per 5 deposits
- Milestone rewards:
  - 50 deposits: 3 draws
  - 100 deposits: 5 draws
  - 300 deposits: 10 draws
  - 500 deposits: 15 draws
  - 1000 deposits: 20 draws
  - 1500 deposits: 25 draws
  - 2000 deposits: 30 draws
  - 3000 deposits: 40 draws
  - 4000 deposits: 45 draws
  - 5000 deposits: 50 draws
  - 6000 deposits: 60 draws
  - 7000 deposits: 70 draws
  - 8000 deposits: 80 draws
  - 9000 deposits: 90 draws
  - 10000 deposits: 100 draws

## Safety & Disclaimer

- Always verify transaction parameters before execution
- Keep your private keys and refresh tokens secure
- Test with small amounts first
- This tool is not officially affiliated with Hanafuda

## Error Handling

The tool includes:

- Automatic retry mechanisms
- Token refresh handling
- Gas fee optimization
- Error logging

## Security Notes

1. Never share your private keys
2. Keep your refresh tokens secure
3. Review the code before running
4. Use dedicated wallets for automation

## Support

For issues or questions:

1. Check existing GitHub issues
2. Create a new issue with detailed information
3. Join the Hanafuda community on their official channels

## License

MIT License - feel free to modify and distribute as needed.
