"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL); // Ganti dengan URL server Node.js Anda

export default function VideoCall() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setupConnection(stream);
        })
        .catch((err) => {
          alert(
            "Failed to access media devices. Please ensure that the app has permissions to access the camera and microphone."
          );
          console.error("Error accessing media devices:", err);
        });
    } else {
      alert("Your device does not support media devices.");
    }
  }, []);

  function setupConnection(stream: MediaStream) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    setPeerConnection(pc);

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log({ eventCandidate: "here" });
        socket.emit("ice-candidate", event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log({ onTrack: "here" });
      if (remoteVideoRef.current)
        remoteVideoRef.current.srcObject = event.streams[0];
    };

    socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", answer);
    });

    socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", async (candidate: RTCIceCandidateInit) => {
      if (!pc) return;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("user-disconnected", (userId: string) => {
      console.log(`User with ID ${userId} disconnected`);
      if (peerConnection) {
        peerConnection.close(); // Close the peer connection
        setPeerConnection(null); // Set peer connection to null
      }
    });
  }

  async function startCall() {
    console.log({ startCall: "here" });
    if (!peerConnection) return;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer);
  }

  return (
    <>
      <div className="flex gap-4 container mx-auto items-center">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-1/2 border-4"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-1/2 border-4"
        />
      </div>
      <div className="flex flex-col gap-2 max-w-sm mt-5 mx-auto">
        <button onClick={startCall} className="bg-blue-700 px-6 py-4">
          Start Call
        </button>
      </div>
    </>
  );
}
