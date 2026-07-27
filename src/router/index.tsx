import { createMemoryRouter } from "react-router-dom";
import RootLayout from "@/layouts/RootLayout";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import UpdatePage from "@/pages/Update";
import AppDetail from "@/pages/AppDetail";
import NotFound from "@/pages/NotFound";

export const router = createMemoryRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "app/:appId", element: <AppDetail /> },
      { path: "settings", element: <Settings /> },
      { path: "update", element: <UpdatePage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
