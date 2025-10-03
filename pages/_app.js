import "@/styles/globals.css";
import ReownProvider from '@/context/reown'

export default function App({ Component, pageProps }) {
  return (
    <ReownProvider>
      {/* Global wallet button at top-right */}
      <div className="fixed top-4 right-4 z-50">
        <appkit-button />
      </div>
      <Component {...pageProps} />
    </ReownProvider>
  )
}
