import { useEffect, useRef, useState } from "react";
import { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { defaultClientConfig } from "../state/config";
import { applyThemeColor } from "../utils/theme-color";
import { readBootstrappedClientConfig } from "./bootstrap-config";
import { client } from "./runtime";

function applyViewportScaling() {
  const highResolutionThreshold = 2560;
  document.documentElement.style.fontSize = window.screen.width >= highResolutionThreshold ? "125%" : "100%";
}

export function useAppBootstrap() {
  const initializedRef = useRef(false);
  const [profile, setProfile] = useState<Profile | undefined | null>(undefined);
  const [config, setConfig] = useState<ConfigWrapper>(new ConfigWrapper({}, new Map()));

  useEffect(() => {
    applyViewportScaling();

    if (initializedRef.current) {
      return;
    }

    const updateClientConfig = (nextConfig: Record<string, unknown>) => {
      sessionStorage.setItem("config", JSON.stringify(nextConfig));
      setConfig(new ConfigWrapper(nextConfig, defaultClientConfig));
      applyThemeColor(typeof nextConfig["theme.color"] === "string" ? nextConfig["theme.color"] : undefined);
    };

    // 登录态查询不阻塞首屏，等浏览器空闲后再请求，避免与首页 feed/tag 请求抢占带宽
    const fetchProfile = () => {
      client.user.profile().then(({ data, error }) => {
        if (data) {
          setProfile({
            id: data.id,
            avatar: data.avatar || "",
            permission: data.permission,
            name: data.username,
          });
        } else if (error) {
          setProfile(null);
        }
      });
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(fetchProfile, { timeout: 2000 });
    } else {
      window.setTimeout(fetchProfile, 200);
    }

    const cachedConfig = sessionStorage.getItem("config");
    const bootstrappedConfig = readBootstrappedClientConfig();

    if (bootstrappedConfig) {
      updateClientConfig(bootstrappedConfig);
    } else if (cachedConfig) {
      const configObject = JSON.parse(cachedConfig) as Record<string, unknown>;
      setConfig(new ConfigWrapper(configObject, defaultClientConfig));
      applyThemeColor(typeof configObject["theme.color"] === "string" ? configObject["theme.color"] : undefined);
    }

    initializedRef.current = true;
  }, []);

  return { config, profile };
}
