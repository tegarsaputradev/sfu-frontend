"use client";
import { useGetMeetingById } from "@/hooks/useGetMeetingById";
import React from "react";

interface IMeetingRoomProps {
  id: string;
}

export const MeetingRoom = ({ id }: IMeetingRoomProps) => {
  const { getLocalStream } = useGetMeetingById(id);
  return (
    <div>
      <button onClick={getLocalStream}>CLick me</button>
    </div>
  );
};
