import { MeetingRoom } from "@/components/MeetingRoom";
import React from "react";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <MeetingRoom id={roomId} />;
}
