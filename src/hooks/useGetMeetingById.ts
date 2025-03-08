import { useSocket } from "@/contexts/SocketProvider";
import { useCallback, useEffect } from "react";

import {
  MediaKind,
  TransportOptions,
  RtpCapabilities,
} from "mediasoup-client/lib/types";

// import * as mediasoupClient from "mediasoup-client";

export const useGetMeetingById = (id: string) => {
  const { socket, isConnected } = useSocket();

  /**
   * Ref
   */

  // const deviceRef = useRef<Device | null>(null);

  const getLocalStream = () => {
    console.log("local stream");
  };

  // const createDevice = async (
  //   rtpCapabilities: RtpCapabilities
  // ): Promise<Device> => {
  //   const newDevice = new mediasoupClient.Device();
  //   await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
  //   deviceRef.current = newDevice;
  //   return newDevice;
  // };

  const joinRoom = useCallback(
    (roomId: string) => {
      if (!socket || !isConnected) return;

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
            alert("error");
          }

          // const {
          //   sendTransportOptions,
          //   recvTransportOptions,
          //   rtpCapabilities,
          //   peerIds,
          //   existingProducers,
          // } = response;

          // const newDevice = await createDevice(rtpCapabilities);
        }
      );
    },
    [socket, isConnected]
  );

  useEffect(() => {
    joinRoom(id);
  }, [id, joinRoom]);

  return { getLocalStream };
};
