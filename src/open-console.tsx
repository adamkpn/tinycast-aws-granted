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
import { indexProfile, indexRegion, indexService, rank } from "./lib/search";
import { SERVICES, Service, findService } from "./lib/services";

const prefs = () => getPreferenceValues<Preferences.OpenConsole>();

function defaultRegion(): string {
  const region = prefs().defaultRegion?.trim();
  return region && isValidRegion(region) ? region : DEFAULT_REGION;
}

function regionFor(profile: Profile): string {
  return prefs().useProfileRegion && profile.region && isValidRegion(profile.region) ? profile.region : defaultRegion();
}

const SERVICE_INDEX = SERVICES.map(indexService);

const byLengthThenName = (a: string, b: string) => a.length - b.length || a.localeCompare(b);

// Tie-break for equal search scores: recent items first, then `fallback`.
function recentFirst<T>(recent: string[], key: (item: T) => string, fallback: (a: T, b: T) => number) {
  const recency = (item: T) => {
    const index = recent.indexOf(key(item));
    return index === -1 ? recent.length : index;
  };
  return (a: T, b: T) => recency(a) - recency(b) || fallback(a, b);
}

// Set synchronously so a double ↵ can't start a second `assume` (and tab).
let launching = false;

async function launch(profile: Profile, service: Service | undefined, region: string) {
  if (launching) return;
  launching = true;
  const options = { profile: profile.name, service: service?.arg || undefined, region };
  const label = `${profile.name} · ${service?.title ?? "Console Home"} · ${region}`;
  let slow: ReturnType<typeof setTimeout> | undefined;
  try {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Opening AWS Console…", message: label });
    // SSO sign-in can take a while; say so instead of looking frozen.
    slow = setTimeout(() => {
      toast.title = "Waiting for Granted…";
      toast.message = `Finish sign-in in your browser · ${label}`;
    }, 5_000);
    try {
      await openConsole(options, prefs().assumePath, prefs().awsFolder);
      clearTimeout(slow);
      await Promise.all([addRecent("profiles", profile.name), service ? addRecent("services", service.id) : undefined]);
      toast.hide();
      await showHUD(`Opened ${label}`);
      await popToRoot();
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "assume failed";
      toast.message = err instanceof Error ? err.message : String(err);
    }
  } finally {
    clearTimeout(slow);
    launching = false;
  }
}

export default function Command() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const { push } = useNavigation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [fromFiles, recent] = await Promise.all([loadProfilesFromFiles(prefs().awsFolder), getRecent("profiles")]);
      if (cancelled) return;
      setProfiles(fromFiles);
      setRecentNames(recent);
      // The CLI is slower, so file profiles render first and CLI ones merge in.
      if (prefs().includeAwsCliProfiles !== false) {
        const fromCli = await loadProfilesFromCli(prefs().awsFolder);
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
  const profileIndex = useMemo(() => profiles.map(indexProfile), [profiles]);
  const results = useMemo(
    () =>
      rank(
        profileIndex,
        searchText,
        recentFirst(
          recentNames,
          (p: Profile) => p.name,
          (a, b) => byLengthThenName(a.name, b.name),
        ),
      ),
    [profileIndex, searchText, recentNames],
  );

  const renderProfile = (profile: Profile) => (
    <List.Item
      key={profile.name}
      id={profile.name}
      title={profile.name}
      icon={{ source: "profile.png" }}
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
    <List
      isLoading={isLoading}
      filtering={false}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search AWS profiles…"
    >
      {!isLoading && profiles.length === 0 ? (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="No AWS profiles found"
          description={profileDebugInfo(prefs().awsFolder)}
        />
      ) : results?.length === 0 ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No Matching Profiles" />
      ) : results ? (
        <List.Section title="Results" subtitle={String(results.length)}>
          {results.map(renderProfile)}
        </List.Section>
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
  const [searchText, setSearchText] = useState("");
  const { push, pop } = useNavigation();

  useEffect(() => {
    getRecent("services").then((ids) =>
      setRecentServices(ids.map(findService).filter((s): s is Service => !!s && s.id !== "dashboard")),
    );
  }, []);

  const recentIds = new Set(recentServices.map((s) => s.id));
  const results = useMemo(
    () =>
      rank(
        SERVICE_INDEX,
        searchText,
        recentFirst(
          recentServices.map((s) => s.id),
          (s: Service) => s.id,
          (a, b) => byLengthThenName(a.title, b.title),
        ),
      ),
    [searchText, recentServices],
  );

  const renderService = (service: Service, section: string) => (
    <List.Item
      key={`${section}-${service.id}`}
      title={service.title}
      subtitle={service.arg || undefined}
      icon={{ source: service.icon }}
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
      filtering={false}
      onSearchTextChange={setSearchText}
      navigationTitle={`${profile.name} · ${region}`}
      searchBarPlaceholder={`Service for ${profile.name} (${region})…`}
    >
      {results?.length === 0 ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No Matching Services" />
      ) : results ? (
        <List.Section title="Results" subtitle={String(results.length)}>
          {results.map((s) => renderService(s, "result"))}
        </List.Section>
      ) : (
        <>
          {recentServices.length > 0 && (
            <List.Section title="Recent">{recentServices.map((s) => renderService(s, "recent"))}</List.Section>
          )}
          <List.Section title="Services" subtitle={region}>
            {SERVICES.filter((s) => !recentIds.has(s.id)).map((s) => renderService(s, "all"))}
          </List.Section>
        </>
      )}
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
  const [searchText, setSearchText] = useState("");
  const regions = useMemo(() => regionsWithDefault(current), [current]);
  const regionIndex = useMemo(() => regions.map(indexRegion), [regions]);
  const shown = useMemo(
    () => rank(regionIndex, searchText, (a, b) => regions.indexOf(a) - regions.indexOf(b)) ?? regions,
    [regionIndex, regions, searchText],
  );
  return (
    <List
      filtering={false}
      onSearchTextChange={setSearchText}
      navigationTitle={`${profile.name} · Region`}
      searchBarPlaceholder="Search regions…"
    >
      {shown.length === 0 && <List.EmptyView icon={Icon.MagnifyingGlass} title="No Matching Regions" />}
      {shown.map((region) => (
        <List.Item
          key={region}
          title={region}
          icon={{ source: "region.png" }}
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
