'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { createAppKit } from '@reown/appkit/react'
import { baseSepolia } from '@reown/appkit/networks'
import { wagmiAdapter, projectId, networks } from '@/config/reown'

const queryClient = new QueryClient()

const metadata = {
  name: 'isaac-app',
  description: 'Reown AppKit Integration',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: baseSepolia,
  metadata,
  features: { analytics: true }
})

export default function ReownProvider({ children }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}


