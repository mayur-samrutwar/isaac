import { cookieStorage, createStorage } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { base, baseSepolia, celo, celoAlfajores } from '@reown/appkit/networks'

export const projectId = '19497b2c2d87b2d5bf9282f4e56206e8'

export const networks = [base, baseSepolia, celo, celoAlfajores]

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks
})

export const wagmiConfig = wagmiAdapter.wagmiConfig


