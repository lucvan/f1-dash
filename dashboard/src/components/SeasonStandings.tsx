"use client";

import { useEffect, useState } from "react";

// Season-to-date championship standings, fetched from the Jolpica-F1 API
// (the maintained successor to Ergast — free, no key, CORS-open).
// Used as the fallback for the Standings page when there is no live race:
// the live SignalR feed only emits ChampionshipPrediction during a race, so
// outside a session we show the official season-to-date table instead.

const DRIVERS_URL = "https://api.jolpi.ca/ergast/f1/current/driverStandings.json";
const CONSTRUCTORS_URL = "https://api.jolpi.ca/ergast/f1/current/constructorStandings.json";

type DriverStanding = {
	position: string;
	points: string;
	wins: string;
	Driver: { givenName: string; familyName: string; code?: string };
	Constructors: { name: string }[];
};

type ConstructorStanding = {
	position: string;
	points: string;
	wins: string;
	Constructor: { name: string };
};

type Standings = {
	season: string;
	round: string;
	drivers: DriverStanding[];
	constructors: ConstructorStanding[];
};

async function fetchStandings(): Promise<Standings> {
	const [driversRes, constructorsRes] = await Promise.all([fetch(DRIVERS_URL), fetch(CONSTRUCTORS_URL)]);

	if (!driversRes.ok || !constructorsRes.ok) {
		throw new Error(`Jolpica request failed (${driversRes.status}/${constructorsRes.status})`);
	}

	const driversJson = await driversRes.json();
	const constructorsJson = await constructorsRes.json();

	const driverList = driversJson?.MRData?.StandingsTable?.StandingsLists?.[0];
	const constructorList = constructorsJson?.MRData?.StandingsTable?.StandingsLists?.[0];

	return {
		season: driverList?.season ?? constructorList?.season ?? "",
		round: driverList?.round ?? constructorList?.round ?? "",
		drivers: driverList?.DriverStandings ?? [],
		constructors: constructorList?.ConstructorStandings ?? [],
	};
}

export default function SeasonStandings() {
	const [data, setData] = useState<Standings | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		fetchStandings()
			.then((s) => active && setData(s))
			.catch((e) => active && setError(e instanceof Error ? e.message : "Failed to load standings"));
		return () => {
			active = false;
		};
	}, []);

	if (error) {
		return (
			<div className="flex h-full w-full flex-col items-center justify-center">
				<p>championship standings unavailable</p>
				<p className="text-sm text-zinc-500">could not reach the season standings source</p>
			</div>
		);
	}

	const loading = !data;
	const hasData = !!data && (data.drivers.length > 0 || data.constructors.length > 0);

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-zinc-800 px-4 py-2 text-sm text-zinc-500">
				{loading
					? "Loading season standings…"
					: `Championship standings · season to date${
							data.season ? ` (${data.season}, after round ${data.round})` : ""
					  } — no live session`}
			</div>

			<div className="grid flex-1 grid-cols-1 divide-y divide-zinc-800 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
				<div className="h-full p-4">
					<h2 className="text-xl">Driver Championship Standings</h2>

					<div className="flex flex-col divide-y divide-zinc-800">
						{loading && new Array(20).fill("").map((_, i) => <SkeletonItem key={`d.${i}`} />)}

						{!loading &&
							data.drivers.map((d) => (
								<div
									className="grid items-center p-2"
									style={{ gridTemplateColumns: "2rem auto 4rem 3rem" }}
									key={d.Driver.code ?? `${d.Driver.givenName}-${d.Driver.familyName}`}
								>
									<p className="text-zinc-400">{d.position}</p>
									<p>
										{d.Driver.givenName} {d.Driver.familyName}
										<span className="ml-2 text-sm text-zinc-500">{d.Constructors[0]?.name}</span>
									</p>
									<p>{d.points}</p>
									<p className="text-sm text-zinc-500">{d.wins} wins</p>
								</div>
							))}
					</div>
				</div>

				<div className="h-full p-4">
					<h2 className="text-xl">Constructor Championship Standings</h2>

					<div className="flex flex-col divide-y divide-zinc-800">
						{loading && new Array(10).fill("").map((_, i) => <SkeletonItem key={`c.${i}`} />)}

						{!loading &&
							data.constructors.map((c) => (
								<div
									className="grid items-center p-2"
									style={{ gridTemplateColumns: "2rem auto 4rem 3rem" }}
									key={c.Constructor.name}
								>
									<p className="text-zinc-400">{c.position}</p>
									<p>{c.Constructor.name}</p>
									<p>{c.points}</p>
									<p className="text-sm text-zinc-500">{c.wins} wins</p>
								</div>
							))}
					</div>
				</div>
			</div>

			{!loading && !hasData && (
				<p className="p-4 text-center text-sm text-zinc-500">no standings published yet for this season</p>
			)}
		</div>
	);
}

const SkeletonItem = () => {
	return (
		<div className="grid items-center gap-2 p-2" style={{ gridTemplateColumns: "2rem auto 4rem 3rem" }}>
			<div className="h-4 w-4 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-4 w-32 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-4 w-10 animate-pulse rounded-md bg-zinc-800" />
			<div className="h-4 w-10 animate-pulse rounded-md bg-zinc-800" />
		</div>
	);
};
