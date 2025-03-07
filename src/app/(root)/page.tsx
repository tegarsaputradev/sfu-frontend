import { SFU } from "@/components/SFU";
import { SocketProvider } from "@/contexts/SocketProvider";

export default function Home() {
  return (
    <>
      <SocketProvider>
        <SFU />
      </SocketProvider>
    </>
  );
}
