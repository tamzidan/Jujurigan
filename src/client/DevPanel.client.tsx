import React, { useState, useEffect } from "@rbxts/react";
import { createRoot } from "@rbxts/react-roblox";
import { Players, ReplicatedStorage, RunService } from "@rbxts/services";

const Shared = ReplicatedStorage.WaitForChild("TS") as Folder;
const Events = Shared.WaitForChild("Events") as Folder;
const DevAction = Events.WaitForChild("DevAction") as RemoteEvent;

// SAMAKAN DENGAN YANG ADA DI SERVER
const ADMIN_USER_IDS = [123456789];

// Palet warna untuk Dev Panel
const COLORS = {
	bg: Color3.fromRGB(30, 30, 30),
	btnBase: Color3.fromRGB(60, 60, 60),
	btnHover: Color3.fromRGB(80, 80, 80),
	text: Color3.fromRGB(255, 255, 255),
	title: Color3.fromRGB(255, 100, 100), 
};

function DevUI() {
	const [isOpen, setIsOpen] = useState(false);
	const [isAdmin, setIsAdmin] = useState(false);

	useEffect(() => {
		const localPlayer = Players.LocalPlayer;
		// Cek apakah pemain berhak melihat UI ini
		if (RunService.IsStudio() || ADMIN_USER_IDS.includes(localPlayer.UserId)) {
			setIsAdmin(true);
		}
	}, []);

	// Jika bukan Admin, jangan tampilkan apa-apa di layar
	if (!isAdmin) return <></>;

	return (
		<screengui IgnoreGuiInset={true} ResetOnSpawn={false}>
			{/* TOMBOL KECIL UNTUK MEMBUKA/MENUTUP PANEL */}
			<textbutton
				Text={isOpen ? "❌" : "🛠️ DEV"}
				Size={new UDim2(0, 70, 0, 35)}
				Position={new UDim2(1, -80, 0, 10)}
				BackgroundColor3={COLORS.bg}
				TextColor3={COLORS.text}
				Font={Enum.Font.GothamBold}
				Event={{ MouseButton1Click: () => setIsOpen(!isOpen) }}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
			</textbutton>

			{/* MENU PANEL (Hanya muncul jika isOpen = true) */}
			{isOpen && (
				<frame
					Size={new UDim2(0, 200, 0, 450)} // Ukuran diperpanjang menjadi 450
					Position={new UDim2(1, -210, 0, 50)}
					BackgroundColor3={COLORS.bg}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uipadding PaddingTop={new UDim(0, 10)} PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} PaddingBottom={new UDim(0, 10)} />
					<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />

					<textlabel
						Text="ADMIN PANEL"
						Size={new UDim2(1, 0, 0, 30)}
						BackgroundTransparency={1}
						TextColor3={COLORS.title}
						Font={Enum.Font.GothamBlack}
						TextScaled={true}
					/>

					{/* DAFTAR TOMBOL CHEAT */}
					<textbutton
						Text="🎭 Force Jadi Jurig"
						Size={new UDim2(1, 0, 0, 35)}
						BackgroundColor3={Color3.fromRGB(150, 50, 50)} // Merah gelap
						TextColor3={COLORS.text}
						Font={Enum.Font.GothamBold}
						Event={{ MouseButton1Click: () => DevAction.FireServer("ForceJurig") }}
					><uicorner CornerRadius={new UDim(0, 4)} /></textbutton>

					<textbutton
						Text="🎭 Force Jadi Baraya"
						Size={new UDim2(1, 0, 0, 35)}
						BackgroundColor3={Color3.fromRGB(50, 100, 150)} // Biru gelap
						TextColor3={COLORS.text}
						Font={Enum.Font.GothamBold}
						Event={{ MouseButton1Click: () => DevAction.FireServer("ForceBaraya") }}
					><uicorner CornerRadius={new UDim(0, 4)} /></textbutton>

					<textbutton
						Text="📷 Toggle Free Cam"
						Size={new UDim2(1, 0, 0, 35)}
						BackgroundColor3={Color3.fromRGB(150, 100, 50)} // Oranye gelap
						TextColor3={COLORS.text}
						Font={Enum.Font.GothamBold}
						Event={{ MouseButton1Click: () => DevAction.FireServer("ToggleCamera") }}
					><uicorner CornerRadius={new UDim(0, 4)} /></textbutton>

					<textbutton
						Text="💰 +10.000 Uang"
						Size={new UDim2(1, 0, 0, 35)}
						BackgroundColor3={COLORS.btnBase}
						TextColor3={COLORS.text}
						Font={Enum.Font.GothamMedium}
						Event={{ MouseButton1Click: () => DevAction.FireServer("AddMoney") }}
					><uicorner CornerRadius={new UDim(0, 4)} /></textbutton>

					<textbutton
						Text="🤖 Spawn Dummy"
						Size={new UDim2(1, 0, 0, 35)}
						BackgroundColor3={COLORS.btnBase}
						TextColor3={COLORS.text}
						Font={Enum.Font.GothamMedium}
						Event={{ MouseButton1Click: () => DevAction.FireServer("SpawnDummy") }}
					><uicorner CornerRadius={new UDim(0, 4)} /></textbutton>

					<textbutton
						Text="🩸 Force Injured"
						Size={new UDim2(1, 0, 0, 35)}
						BackgroundColor3={COLORS.btnBase}
						TextColor3={COLORS.text}
						Font={Enum.Font.GothamMedium}
						Event={{ MouseButton1Click: () => DevAction.FireServer("SetInjured") }}
					><uicorner CornerRadius={new UDim(0, 4)} /></textbutton>

					<textbutton
						Text="💀 Force Knock"
						Size={new UDim2(1, 0, 0, 35)}
						BackgroundColor3={COLORS.btnBase}
						TextColor3={COLORS.text}
						Font={Enum.Font.GothamMedium}
						Event={{ MouseButton1Click: () => DevAction.FireServer("SetKnock") }}
					><uicorner CornerRadius={new UDim(0, 4)} /></textbutton>

				</frame>
			)}
		</screengui>
	);
}

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
const root = createRoot(playerGui);
root.render(<DevUI />);