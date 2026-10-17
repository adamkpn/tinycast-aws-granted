import {
  Action,
  ActionPanel,
  Icon,
  Keyboard,
  List,
  Toast,
  getPreferenceValues,
  popToRoot,
  showHUD,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { assumeCommand, openConsole } from "./lib/granted";
import { Profile, loadProfilesFromCli, loadProfilesFromFiles, mergeProfiles, profileDebugInfo } from "./lib/profiles";
import { addRecent, getRecent } from "./lib/recent";
import { DEFAULT_REGION, isValidRegion, regionsWithDefault } from "./lib/regions";
import { SERVICES, Service, findService } from "./lib/services";

const prefs = () => getPreferenceValues<Preferences.OpenConsole>();

function defaultRegion(): string {
  const region = prefs().defaultRegion?.trim();
  return region && isValidRegion(region) ? region : DEFAULT_REGION;
}

function regionFor(profile: Profile): string {
  return prefs().useProfileRegion && profile.region && isValidRegion(profile.region) ? profile.region : defaultRegion();
}

function splitWords(name: string): string[] {
  return name.split(/[-_./\s]+/).filter(Boolean);
}

async function launch(profile: Profile, service: Service | undefined, region: string) {
  const options = { profile: profile.name, service: service?.arg || undefined, region };
  const label = `${profile.name} · ${service?.title ?? "Console Home"} · ${region}`;
  const toast = await showToast({ style: Toast.Style.Animated, title: "Opening AWS Console…", message: label });
  try {
    await openConsole(options, prefs().assumePath);
    await Promise.all([addRecent("profiles", profile.name), service ? addRecent("services", service.id) : undefined]);
    toast.hide();
    await showHUD(`Opened ${label}`);
    await popToRoot();
  } catch (err) {
    toast.style = Toast.Style.Failure;
    toast.title = "assume failed";
    toast.message = err instanceof Error ? err.message : String(err);
  }
}

export default function Command() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [fromFiles, recent] = await Promise.all([loadProfilesFromFiles(), getRecent("profiles")]);
      if (cancelled) return;
      setProfiles(fromFiles);
      setRecentNames(recent);
      // The CLI is slower, so file profiles render first and CLI ones merge in.
      if (prefs().includeAwsCliProfiles !== false) {
        const fromCli = await loadProfilesFromCli();
        if (!cancelled && fromCli.length) setProfiles((current) => mergeProfiles(current, fromCli));
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentProfiles = useMemo(
    () => recentNames.map((name) => profiles.find((p) => p.name === name)).filter((p): p is Profile => !!p),
    [recentNames, profiles],
  );
  const otherProfiles = useMemo(() => profiles.filter((p) => !recentNames.includes(p.name)), [profiles, recentNames]);

  const renderProfile = (profile: Profile) => (
    <List.Item
      key={profile.name}
      id={profile.name}
      title={profile.name}
      icon={{ source: "profile.png" }}
      keywords={splitWords(profile.name)}
      accessories={[
        ...(profile.accountId ? [{ text: profile.accountId, tooltip: "Account ID" }] : []),
        ...(profile.region ? [{ tag: profile.region, tooltip: "Profile region" }] : []),
      ]}
      actions={
        <ActionPanel title={profile.name}>
          <Action
            title="Choose Region"
            icon={Icon.Map}
            onAction={() =>
              push(
                <RegionList
                  profile={profile}
                  current={regionFor(profile)}
                  onSelect={(region) => push(<ServiceList profile={profile} region={region} />)}
                />,
              )
            }
          />
          <Action
            title="Open Console Home"
            icon={Icon.Globe}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            onAction={() => launch(profile, undefined, regionFor(profile))}
          />
          <Action
            title="Choose Service in Default Region"
            icon={Icon.AppWindowGrid3x3}
            shortcut={{ modifiers: ["opt"], key: "return" }}
            onAction={() => push(<ServiceList profile={profile} region={regionFor(profile)} />)}
          />
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Profile Name"
              content={profile.name}
              shortcut={Keyboard.Shortcut.Common.CopyName}
            />
            <Action.CopyToClipboard
              title="Copy Assume Command"
              content={assumeCommand({ profile: profile.name, region: regionFor(profile) })}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search AWS profiles…" navigationTitle="AWS Granted">
      {!isLoading && profiles.length === 0 ? (
        <List.EmptyView icon={Icon.ExclamationMark} title="No AWS profiles found" description={profileDebugInfo()} />
      ) : (
        <>
          {recentProfiles.length > 0 && <List.Section title="Recent">{recentProfiles.map(renderProfile)}</List.Section>}
          <List.Section title="Profiles" subtitle={String(otherProfiles.length)}>
            {otherProfiles.map(renderProfile)}
          </List.Section>
        </>
      )}
    </List>
  );
}

function ServiceList({ profile, region: initialRegion }: { profile: Profile; region: string }) {
  const [region, setRegion] = useState(initialRegion);
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const { push, pop } = useNavigation();

  useEffect(() => {
    getRecent("services").then((ids) =>
      setRecentServices(ids.map(findService).filter((s): s is Service => !!s && s.id !== "dashboard")),
    );
  }, []);

  const recentIds = new Set(recentServices.map((s) => s.id));

  const renderService = (service: Service, section: string) => (
    <List.Item
      key={`${section}-${service.id}`}
      title={service.title}
      subtitle={service.arg || undefined}
      icon={{ source: service.icon }}
      keywords={service.keywords.split(" ")}
      actions={
        <ActionPanel title={service.title}>
          <Action title="Open in Console" icon={Icon.Globe} onAction={() => launch(profile, service, region)} />
          <Action
            title="Open Console Home"
            icon={Icon.House}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            onAction={() => launch(profile, undefined, region)}
          />
          <Action
            title="Change Region"
            icon={Icon.Map}
            shortcut={{ modifiers: ["opt"], key: "return" }}
            onAction={() =>
              push(
                <RegionList
                  profile={profile}
                  current={region}
                  onSelect={(next) => {
                    setRegion(next);
                    pop();
                  }}
                />,
              )
            }
          />
          <Action.CopyToClipboard
            title="Copy Assume Command"
            content={assumeCommand({ profile: profile.name, service: service.arg || undefined, region })}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
        </ActionPanel>
      }
    />
  );

  return (
    <List
      navigationTitle={`${profile.name} · ${region}`}
      searchBarPlaceholder={`Service for ${profile.name} (${region})…`}
    >
      {recentServices.length > 0 && (
        <List.Section title="Recent">{recentServices.map((s) => renderService(s, "recent"))}</List.Section>
      )}
      <List.Section title="Services" subtitle={region}>
        {SERVICES.filter((s) => !recentIds.has(s.id)).map((s) => renderService(s, "all"))}
      </List.Section>
    </List>
  );
}

function RegionList({
  profile,
  current,
  onSelect,
}: {
  profile: Profile;
  current: string;
  onSelect: (region: string) => void;
}) {
  const fallback = defaultRegion();
  return (
    <List navigationTitle={`${profile.name} · Region`} searchBarPlaceholder="Search regions…">
      {regionsWithDefault(current).map((region) => (
        <List.Item
          key={region}
          title={region}
          icon={{ source: "region.png" }}
          keywords={region.split("-")}
          accessories={[
            ...(region === current ? [{ icon: Icon.Checkmark, tooltip: "Current" }] : []),
            ...(region === profile.region ? [{ tag: "profile" }] : []),
            ...(region === fallback ? [{ tag: "default" }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action title="Select Region" icon={Icon.Checkmark} onAction={() => onSelect(region)} />
              <Action
                title="Open Console Home Here"
                icon={Icon.Globe}
                shortcut={{ modifiers: ["cmd"], key: "return" }}
                onAction={() => launch(profile, undefined, region)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
