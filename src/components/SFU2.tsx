"use client";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import {
  Device,
  DtlsParameters,
  RtpParameters,
  MediaKind,
  Producer,
  Transport,
  TransportOptions,
} from "mediasoup-client/lib/types";
import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

const SERVER_URL = `${process.env.NEXT_PUBLIC_SOCKET_URL}/test-socket`;
// const SERVER_URL = "https://192.168.0.109:5000/test-socket";

export const SFU2 = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sendTransport, setSendTransport] = useState<Transport | null>(null);
  const [recvTransport, setRecvTransport] = useState<Transport | null>(null);
  const [joined, setJoined] = useState<boolean>(false);
  const [roomId, setRoomId] = useState<string>("");
  const [peers, setPeers] = useState<string[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoProducer, setVideoProducer] = useState<Producer | null>(null);
  const [audioProducer, setAudioProducer] = useState<Producer | null>(null);
  const [screenProducer, setScreenProducer] = useState<Producer | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const deviceRef = useRef<Device | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to server:", newSocket.id);
    });

    newSocket.on("new-peer", ({ peerId }: { peerId: string }) => {
      setPeers((prevPeers) => [...prevPeers, peerId]);
    });

    newSocket.on("peer-left", ({ peerId }: { peerId: string }) => {
      setPeers((prevPeers) => prevPeers.filter((id) => id !== peerId));
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const createDevice = async (
    rtpCapabilities: RtpCapabilities
  ): Promise<Device> => {
    const newDevice = new mediasoupClient.Device();
    await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
    deviceRef.current = newDevice;
    return newDevice;
  };

  const createSendTransport = (
    device: Device,
    transportOptions: TransportOptions
  ): Transport | undefined => {
    if (!socket) return;

    const newSendTransport = device.createSendTransport({
      ...transportOptions,
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // Free Google STUN server
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        // Optional: Add a TURN server for better reliability
        // {
        //   urls: "turn:your-turn-server.com:3478",
        //   username: "username",
        //   credential: "password",
        // },
      ],
    });

    newSendTransport.on(
      "connect",
      (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback,
        errback
      ) => {
        try {
          socket.emit("connect-transport", {
            transportId: newSendTransport.id,
            dtlsParameters,
            roomId,
            peerId: socket.id,
          });
          callback();
        } catch (error) {
          errback(error as Error);
        }
      }
    );

    newSendTransport.on(
      "produce",
      (
        {
          kind,
          rtpParameters,
        }: { kind: MediaKind; rtpParameters: RtpParameters },
        callback: (params: { id: string }) => void,
        errback
      ) => {
        try {
          socket.emit(
            "produce",
            {
              transportId: newSendTransport.id,
              kind,
              rtpParameters,
              roomId,
              peerId: socket.id,
            },
            (producerId: string) => {
              callback({ id: producerId });
            }
          );
        } catch (error) {
          errback(error as Error);
        }
      }
    );

    setSendTransport(newSendTransport);
    return newSendTransport;
  };

  const createRecvTransport = (
    device: Device,
    transportOptions: TransportOptions
  ): Transport | undefined => {
    if (!socket) return;

    const newRecvTransport = device.createRecvTransport({
      ...transportOptions,
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // Free Google STUN server
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        // Optional: Add a TURN server for better reliability
        // {
        //   urls: "turn:your-turn-server.com:3478",
        //   username: "username",
        //   credential: "password",
        // },
      ],
    });
    newRecvTransport.on(
      "connect",
      (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback,
        errback
      ) => {
        try {
          socket.emit("connect-transport", {
            transportId: newRecvTransport.id,
            dtlsParameters,
            roomId,
            peerId: socket.id,
          });
          callback();
        } catch (error) {
          errback(error as Error);
        }
      }
    );

    setRecvTransport(newRecvTransport);
    recvTransportRef.current = newRecvTransport;
    return newRecvTransport;
  };

  const getLocalAudioStreamAndTrack = async (): Promise<MediaStreamTrack> => {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    return audioStream.getAudioTracks()[0];
  };

  const joinRoom = () => {
    if (!socket || !roomId) return;

    if (window.confirm("방에 참여하시겠습니까?")) {
      socket.emit(
        "join-room",
        { roomId, peerId: socket.id },
        async (response: {
          sendTransportOptions: TransportOptions;
          recvTransportOptions: TransportOptions;
          rtpCapabilities: RtpCapabilities;
          peerIds: string[];
          existingProducers: {
            producerId: string;
            peerId: string;
            kind: MediaKind;
          }[];
          error?: string;
        }) => {
          if (response.error) {
            console.error("Error joining room:", response.error);
            return;
          }

          const {
            sendTransportOptions,
            recvTransportOptions,
            rtpCapabilities,
            peerIds,
            existingProducers,
          } = response;

          console.log({ joinRoom: "1" });
          const newDevice = await createDevice(rtpCapabilities);
          console.log({ joinRoom: "2" });
          const newSendTransport = createSendTransport(
            newDevice,
            sendTransportOptions
          );
          console.log({ joinRoom: "3" });

          if (!newSendTransport) return;
          console.log({ joinRoom: "4" });

          createRecvTransport(newDevice, recvTransportOptions);
          console.log({ joinRoom: "5" });

          socket.on("new-producer", handleNewProducer);

          const audioTrack = await getLocalAudioStreamAndTrack();
          const newAudioProducer = await newSendTransport.produce({
            track: audioTrack,
          });

          setAudioProducer(newAudioProducer);
          setPeers(peerIds.filter((id) => id !== socket.id));

          for (const producerInfo of existingProducers) {
            await consume(producerInfo);
          }

          setJoined(true);
        }
      );
    }
  };

  const leaveRoom = () => {
    if (!socket) return;

    socket.emit("leave-room", (response: { error?: Error }) => {
      if (response?.error) {
        console.error("Error leaving room:", response.error);
        return;
      }

      setJoined(false);
      setPeers([]);

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      if (sendTransport) {
        sendTransport.close();
        setSendTransport(null);
      }
      if (recvTransport) {
        recvTransport.close();
        setRecvTransport(null);
      }

      socket.off("new-producer", handleNewProducer);
    });
  };

  const startCamera = async () => {
    if (!sendTransport) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });
    setLocalStream(stream);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const videoTrack = stream.getVideoTracks()[0];
    const newVideoProducer = await sendTransport.produce({ track: videoTrack });
    setVideoProducer(newVideoProducer);
  };

  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (videoProducer) {
      videoProducer.close();
      setVideoProducer(null);
    }
    if (audioProducer) {
      audioProducer.close();
      setAudioProducer(null);
    }
  };

  const startScreenShare = async () => {
    if (!sendTransport) return;

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });
    const screenTrack = stream.getVideoTracks()[0];
    const newScreenProducer = await sendTransport.produce({
      track: screenTrack,
    });
    setScreenProducer(newScreenProducer);

    screenTrack.onended = () => {
      stopScreenShare();
    };
  };

  const stopScreenShare = () => {
    if (screenProducer) {
      screenProducer.close();
      setScreenProducer(null);
    }
  };

  const handleNewProducer = async ({
    producerId,
    peerId,
    kind,
  }: {
    producerId: string;
    peerId: string;
    kind: MediaKind;
  }) => {
    await consume({ producerId, peerId, kind });
  };

  const consume = async ({
    producerId,
    peerId,
    kind,
  }: {
    producerId: string;
    peerId: string;
    kind: MediaKind;
  }) => {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;

    if (!device || !recvTransport || !socket) {
      console.log("Device or RecvTransport not initialized", peerId, kind);
      return;
    }

    socket.emit(
      "consume",
      {
        transportId: recvTransport.id,
        producerId,
        roomId,
        peerId: socket.id,
        rtpCapabilities: device.rtpCapabilities,
      },
      async (response: {
        error?: string;
        consumerData?: {
          id: string;
          producerId: string;
          kind: MediaKind;
          rtpParameters: RtpParameters;
        };
      }) => {
        if (response.error) {
          console.error("Error consuming:", response.error);
          return;
        }

        if (!response.consumerData) return;

        const consumer = await recvTransport.consume({
          id: response.consumerData.id,
          producerId: response.consumerData.producerId,
          kind: response.consumerData.kind,
          rtpParameters: response.consumerData.rtpParameters,
        });

        await consumer.resume();

        const remoteStream = new MediaStream();
        remoteStream.addTrack(consumer.track);

        console.log({ consumer });
        if (consumer.kind === "video") {
          console.log("videoKind");
          const videoElement = document.createElement("video");
          videoElement.srcObject = remoteStream;
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.width = 200;
          document.getElementById("remote-media")?.appendChild(videoElement);
        } else if (consumer.kind === "audio") {
          const audioElement = document.createElement("audio");
          audioElement.srcObject = remoteStream;
          audioElement.autoplay = true;
          audioElement.controls = true;
          document.getElementById("remote-media")?.appendChild(audioElement);

          try {
            await audioElement.play();
          } catch (err) {
            console.error("Audio playback failed:", err);
          }
        }
      }
    );
  };

  return (
    <div>
      <h1>Mediasoup Demo</h1>
      <h2>My Id: {socket ? socket.id : "Not connected"}</h2>
      <h2>Room: {roomId ? roomId : "-"}</h2>
      {!joined ? (
        <div>
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <div>
          <button onClick={leaveRoom}>Leave Room</button>
          <button onClick={localStream ? stopCamera : startCamera}>
            {localStream ? "Stop Camera" : "Start Camera"}
          </button>
          <button onClick={screenProducer ? stopScreenShare : startScreenShare}>
            {screenProducer ? "Stop Screen Share" : "Start Screen Share"}
          </button>
        </div>
      )}
      <div>
        <h2>Local Video</h2>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          width="400"
        ></video>
      </div>
      <div>
        <h2>Peers in Room</h2>
        <ul>
          {peers.map((peerId) => (
            <li key={peerId}>{peerId}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Remote Media</h2>
        <div id="remote-media"></div>
      </div>
    </div>
  );
};
