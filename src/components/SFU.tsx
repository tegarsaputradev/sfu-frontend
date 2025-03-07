"use client";
import React, { useRef, useState } from "react";
import { Button } from "./Button";
import { useSocket } from "@/contexts/SocketProvider";
import {
  Device,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  MediaKind,
  ProducerOptions,
  RtpCapabilities,
  RtpParameters,
  Transport,
} from "mediasoup-client/lib/types";

let produceOptions: ProducerOptions = {
  encodings: [
    {
      rid: "r0",
      maxBitrate: 100000,
      scalabilityMode: "S1T3",
    },
    {
      rid: "r1",
      maxBitrate: 300000,
      scalabilityMode: "S1T3",
    },
    {
      rid: "r2",
      maxBitrate: 900000,
      scalabilityMode: "S1T3",
    },
  ],
  codecOptions: {
    videoGoogleStartBitrate: 1000,
  },
};

export const SFU = () => {
  const { socket, isConnected } = useSocket();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [rtpCapabilities, setRtpCapabilities] = useState<
    RtpCapabilities | undefined
  >();
  const [device, setDevice] = useState<Device>();
  const [sendTransport, setSendTransport] = useState<Transport>();
  const [recTransport, setRecTransport] = useState<Transport>();
  const [producerId, setProducerId] = useState<string>();

  const getLocalVideoStream = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          produceOptions = {
            track: stream.getVideoTracks()[0],
            ...produceOptions,
          };
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
  };

  const getRtpCapabilities = () => {
    if (!socket || !isConnected) return;
    // make a request to the server for Router RTP Capabilities
    // see server's socket.on('getRtpCapabilities', ...)
    // the server sends back data object which contains rtpCapabilities
    socket.emit(
      "getRtpCapabilities",
      (data: { rtpCapabilities: RtpCapabilities }) => {
        console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`);

        // we assign to local variable and will be used when
        // loading the client Device (see createDevice above)
        setRtpCapabilities(data.rtpCapabilities);
      }
    );
  };

  const createDevice = async () => {
    try {
      const device = new Device();

      // https://mediasoup.org/documentation/v3/mediasoup-client/api/#device-load
      // Loads the device with RTP capabilities of the Router (server side)
      if (rtpCapabilities) {
        await device.load({
          // see getRtpCapabilities() below
          routerRtpCapabilities: rtpCapabilities,
        });

        setDevice(device);
      }

      console.log("RTP Capabilities", device.rtpCapabilities);
    } catch (error) {
      const err = error as Error;

      if (err.name === "UnsupportedError")
        console.warn("browser not supported");
    }
  };

  const createSendTransport = () => {
    if (!socket || !isConnected) return;
    // see server's socket.on('createWebRtcTransport', sender?, ...)
    // this is a call from Producer, so sender = true
    socket.emit(
      "createWebRtcTransport",
      { sender: true },
      (data: {
        params?: {
          id: string;
          iceParameters: IceParameters;
          iceCandidates: IceCandidate[];
          dtlsParameters: DtlsParameters;
        };
        error?: string;
      }) => {
        if (!device) return;
        // The server sends back params needed
        // to create Send Transport on the client side
        if (data.error) {
          console.log(data.error);
          return;
        }

        if (!data.params) {
          return;
        }

        console.log(data.params);

        // creates a new WebRTC Transport to send media
        // based on the server's producer transport data
        // https://mediasoup.org/documentation/v3/mediasoup-client/api/#TransportOptions
        const producerTransport = device.createSendTransport(data.params);

        // https://mediasoup.org/documentation/v3/communication-between-client-and-server/#producing-media
        // this event is raised when a first call to transport.produce() is made
        // see connectSendTransport() below
        producerTransport.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            try {
              // Signal local DTLS parameters to the server side transport
              // see server's socket.on('transport-connect', ...)
              await socket.emit(
                "transport-connect",
                {
                  transportId: producerTransport.id,
                  dtlsParameters,
                },
                ({ error }: { error: string }) => {
                  console.log({ error });
                }
              );

              // Tell the transport that parameters were transmitted.
              callback();
            } catch (error) {
              const err = error as Error;
              errback(err);
            }
          }
        );

        producerTransport.on(
          "produce",
          async (parameters, callback, errback) => {
            console.log({ parameters });

            try {
              // tell the server to create a Producer
              // with the following parameters and produce
              // and expect back a server side producer id
              // see server's socket.on('transport-produce', ...)
              await socket.emit(
                "transport-produce",
                {
                  transportId: producerTransport.id,
                  kind: parameters.kind,
                  rtpParameters: parameters.rtpParameters,
                  appData: parameters.appData,
                },
                ({ id }: { id: string }) => {
                  // Tell the transport that parameters were transmitted and provide it with the
                  // server side producer's id.
                  setProducerId(id);
                  callback({ id });
                }
              );
            } catch (error) {
              const err = error as Error;
              errback(err);
            }
          }
        );

        setSendTransport(producerTransport);
      }
    );
  };

  const connectSendTransport = async () => {
    if (!sendTransport) return;
    // we now call produce() to instruct the producer transport
    // to send media to the Router
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
    // this action will trigger the 'connect' and 'produce' events above

    const producer = await sendTransport.produce({ ...produceOptions });

    producer.on("trackended", () => {
      console.log("track ended");

      // close video track
    });

    producer.on("transportclose", () => {
      console.log("transport ended");

      // close video track
    });
  };

  const createRecvTransport = async () => {
    if (!socket || !isConnected || !device) return;
    // see server's socket.on('consume', sender?, ...)
    // this is a call from Consumer, so sender = false
    await socket.emit(
      "createWebRtcTransport",
      { sender: false },
      (data: {
        params?: {
          id: string;
          iceParameters: IceParameters;
          iceCandidates: IceCandidate[];
          dtlsParameters: DtlsParameters;
        };
        error?: string;
      }) => {
        // The server sends back params needed
        // to create Send Transport on the client side
        if (data.error) {
          console.log(data.error);
          return;
        }

        if (!data.params) {
          return;
        }

        console.log(data.params);

        // creates a new WebRTC Transport to receive media
        // based on server's consumer transport params
        // https://mediasoup.org/documentation/v3/mediasoup-client/api/#device-createRecvTransport
        const consumerTransport = device.createRecvTransport(data.params);

        // https://mediasoup.org/documentation/v3/communication-between-client-and-server/#producing-media
        // this event is raised when a first call to transport.produce() is made
        // see connectRecvTransport() below
        consumerTransport.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            try {
              // Signal local DTLS parameters to the server side transport
              // see server's socket.on('transport-recv-connect', ...)
              await socket.emit("transport-recv-connect", {
                dtlsParameters,
              });

              // Tell the transport that parameters were transmitted.
              callback();
            } catch (error) {
              const err = error as Error;
              // Tell the transport that something was wrong
              errback(err);
            }
          }
        );

        setRecTransport(consumerTransport);
      }
    );
  };

  const connectRecvTransport = async () => {
    if (!socket || !isConnected || !recTransport || !device) return;
    // for consumer, we need to tell the server first
    // to create a consumer based on the rtpCapabilities and consume
    // if the router can consume, it will send back a set of params as below

    await socket.emit(
      "consume",
      {
        producerId,
        transportId: recTransport.id,
        rtpCapabilities: device.rtpCapabilities,
      },
      async ({
        params,
      }: {
        params: {
          id: string;
          producerId: string;
          kind: MediaKind;
          rtpParameters: RtpParameters;
          error?: string;
        };
      }) => {
        if (params.error) {
          console.log("Cannot Consume");
          return;
        }

        console.log(params);
        // then consume with the local consumer transport
        // which creates a consumer
        const consumer = await recTransport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        // Verify the consumer and its track
        console.log("Consumer created:", consumer);
        console.log("Consumer track:", consumer.track);

        // destructure and retrieve the video track from the producer
        const newStream = new MediaStream();
        newStream.addTrack(consumer.track);

        // Assign the stream to the remote video element
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = newStream;
          console.log(
            "Stream assigned to remoteVideoRef:",
            remoteVideoRef.current.srcObject
          );
        } else {
          console.error("remoteVideoRef is not available");
        }

        // the server consumer started with media paused
        // so we need to inform the server to resume
        socket.emit("consumer-resume", { id: consumer.id });
      }
    );
  };
  return (
    <div className="w-full h-screen">
      <div className="grid grid-cols-2 gap-4 container mx-auto justify-center py-10">
        <div className="w-full flex flex-col gap-2">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video border-4"
          />
          <div className="mt-8 flex flex-col gap-4 justify-start items-start">
            <Button onClick={getLocalVideoStream}>1. Get local video</Button>
            <Button onClick={getRtpCapabilities}>
              2. Get rtp capabilities
            </Button>
            <Button onClick={createDevice}>3. Create device</Button>
            <Button onClick={createSendTransport}>
              4. Create send transport
            </Button>
            <Button onClick={connectSendTransport}>
              5. Connect send transport & produce
            </Button>
          </div>
        </div>
        <div className="w-full flex flex-col gap-2">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video border-4"
          />
          <ol className="mt-8 flex flex-col gap-4 justify-start items-start">
            <li>
              <Button onClick={getLocalVideoStream}>1. Get local video</Button>
            </li>
            <li>
              <Button onClick={getLocalVideoStream}>
                2. Get RTP Capabilities
              </Button>
            </li>
            <li>
              <Button onClick={createRecvTransport}>
                3. Create receiver transport
              </Button>
            </li>
            <li>
              <Button onClick={connectRecvTransport}>
                4. Connect receiver transport & Consume
              </Button>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
