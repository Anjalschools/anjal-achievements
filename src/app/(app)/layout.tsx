"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userData, setUserData] = useState({
    userName: "",
    userFullName: "",
    userEmail: "",
    userAvatar: undefined as string | undefined,
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setUserData({
            userName: data.username || "",
            userFullName: data.fullName || "",
            userEmail: data.email || "",
            userAvatar: data.profilePhoto,
          });
        }
      } catch (error) {
        console.error("Error fetching user data for header:", error);
      }
    };
    fetchUserData();
  }, []);

  return (
    <AppShell
      userName={userData.userName}
      userFullName={userData.userFullName}
      userEmail={userData.userEmail}
      userAvatar={userData.userAvatar}
    >
      {children}
    </AppShell>
  );
}
