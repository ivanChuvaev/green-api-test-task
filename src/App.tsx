import { MaxUI } from '@maxhub/max-ui'
import { ToastContainer } from 'react-toastify'
import { ChatPage } from './components/ChatPage'
import { LoginPage } from './components/LoginPage'
import { useSession } from './hooks/useSession'
import { TOAST_AUTO_CLOSE_MS, TOAST_LIMIT, TOAST_POSITION } from './lib/toast'

export const App = () => {
  const session = useSession()

  return (
    <MaxUI resetBody>
      {session.credentials ? (
        <ChatPage credentials={session.credentials} onLogout={session.clear} />
      ) : (
        <LoginPage initial={session.restore()} onConnect={session.save} />
      )}

      <ToastContainer
        position={TOAST_POSITION}
        autoClose={TOAST_AUTO_CLOSE_MS}
        limit={TOAST_LIMIT}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        pauseOnHover
        draggable
        hideProgressBar={false}
        closeButton={false}
      />
    </MaxUI>
  )
}
