import { useState, useRef, useEffect } from 'react'
import { initiateSocketConnection } from './utils/socket'

export default function VideoChat() {
  const [me, setMe] = useState('')
  const [remoteId, setRemoteId] = useState('')
  const [incomingCall, setIncomingCall] = useState(false)
  const [caller, setCaller] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnection = useRef()
  const socket = useRef(null)

  useEffect(() => {
    // Initialize socket connection
    socket.current = initiateSocketConnection()

    // Initialize WebRTC peer connection
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    // Socket event handlers
    socket.current.on('connect', () => {
      setMe(socket.current.id)
      setIsConnected(true)
    })

    socket.current.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.current.on('call-made', async ({ from, offer }) => {
      setCaller(from)
      setIncomingCall(true)
      try {
        await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(offer))
      } catch (err) {
        console.error('Error setting remote description:', err)
        setModalMessage('Error setting up call. Please try again.')
        setShowModal(true)
        setIncomingCall(false)
      }
    })

    socket.current.on('call-accepted', async ({ answer }) => {
      try {
        await peerConnection.current?.setRemoteDescription(
          new RTCSessionDescription(answer)
        )
        setModalMessage('Call connected!')
        setShowModal(true)
      } catch (err) {
        console.error('Error setting remote description:', err)
      }
    })

    socket.current.on('call-rejected', ({ from }) => {
      setModalMessage(`Call rejected by: ${from}`)
      setShowModal(true)
      cleanupCall()
    })

    socket.current.on('ice-candidate', async ({ candidate }) => {
      try {
        if (candidate) {
          await peerConnection.current?.addIceCandidate(
            new RTCIceCandidate(candidate)
          )
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err)
      }
    })

    // WebRTC event handlers
    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit('ice-candidate', {
          to: remoteId || caller,
          candidate: event.candidate,
        })
      }
    }

    // Cleanup
    return () => {
      cleanupCall()
      socket.current?.disconnect()
    }
  }, [remoteId, caller])

  const checkMediaPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      return true
    } catch (err) {
      console.error('Media permission check failed:', err)
      let errorMessage = 'Media access error: '
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Camera or microphone access denied. Please check your permissions.'
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Camera or microphone not found. Please check your device connections.'
      } else {
        errorMessage += 'Please check your camera/microphone permissions and try again.'
      }
      setModalMessage(errorMessage)
      setShowModal(true)
      return false
    }
  }

  const startCall = async () => {
    if (await checkMediaPermissions()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        stream.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, stream)
        })

        const offer = await peerConnection.current.createOffer()
        await peerConnection.current.setLocalDescription(offer)

        socket.current.emit('call-user', { to: remoteId, offer })
      } catch (err) {
        console.error('Error starting call:', err)
        let errorMessage = 'Failed to start call. '
        if (err.name === 'NotAllowedError') {
          errorMessage += 'Camera or microphone access denied. Please check your permissions.'
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'Camera or microphone not found. Please check your device connections.'
        } else {
          errorMessage += 'Please check your camera/microphone permissions and try again.'
        }
        setModalMessage(errorMessage)
        setShowModal(true)
      }
    }
  }

  const acceptCall = async () => {
    if (await checkMediaPermissions()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        stream.getTracks().forEach((track) => {
          peerConnection.current?.addTrack(track, stream)
        })

        if (peerConnection.current.signalingState !== "have-remote-offer") {
          console.error("PeerConnection is not in the correct state to create an answer");
          setModalMessage("Error: Unable to accept call at this time. Please try again.");
          setShowModal(true);
          setIncomingCall(false);
          return;
        }

        const answer = await peerConnection.current?.createAnswer()
        await peerConnection.current?.setLocalDescription(answer)

        socket.current.emit('accept-call', { to: caller, answer })
        setIncomingCall(false)
      } catch (err) {
        console.error('Error accepting call:', err)
        let errorMessage = 'Failed to accept call. '
        if (err.name === 'NotAllowedError') {
          errorMessage += 'Camera or microphone access denied. Please check your permissions.'
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'Camera or microphone not found. Please check your device connections.'
        } else if (err.name === 'InvalidStateError') {
          errorMessage += 'Call setup failed. Please try again.'
        } else {
          errorMessage += 'Please check your camera/microphone permissions and try again.'
        }
        setModalMessage(errorMessage)
        setShowModal(true)
        setIncomingCall(false)
      }
    } else {
      setIncomingCall(false)
    }
  }

  const rejectCall = () => {
    socket.current.emit('reject-call', { to: caller })
    setIncomingCall(false)
    cleanupCall()
  }

  const cleanupCall = () => {
    if (localVideoRef.current?.srcObject) {
      (localVideoRef.current.srcObject)
        .getTracks()
        .forEach((track) => track.stop())
    }
    if (remoteVideoRef.current?.srcObject) {
      (remoteVideoRef.current.srcObject)
        .getTracks()
        .forEach((track) => track.stop())
    }
    peerConnection.current?.close()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Video Chat</h1>

      <div className="bg-card rounded-lg p-6 shadow-lg w-full max-w-md mb-8">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <h3 className="text-sm font-medium">
              Status: {isConnected ? 'Connected' : 'Disconnected'}
            </h3>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Your ID:</p>
            <code className="block bg-muted p-2 rounded text-sm">{me || 'Connecting...'}</code>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Enter ID to call:</label>
            <div className="flex space-x-2">
              <input
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                type="text"
                placeholder="Paste ID here"
                value={remoteId}
                onChange={(e) => setRemoteId(e.target.value)}
              />
              <button
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium"
                onClick={startCall}
                disabled={!isConnected || !remoteId}
              >
                Call
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
            You
          </div>
        </div>
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
            Remote
          </div>
        </div>
      </div>

      {incomingCall && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Incoming call from: {caller}
            </h3>
            <div className="flex space-x-2 justify-end">
              <button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-md text-sm font-medium"
                onClick={rejectCall}
              >
                Reject
              </button>
              <button
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium"
                onClick={acceptCall}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">{modalMessage}</h3>
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium w-full"
              onClick={() => setShowModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
