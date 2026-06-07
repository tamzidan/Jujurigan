// ... existing code ...
import { Players } from "@rbxts/services";

const player = Players.LocalPlayer;

function UpdateCamera() {
	const isDevFreeCam = player.GetAttribute("DevFreeCam") as boolean;

	if (isDevFreeCam) {
		// Jika Dev Free Cam aktif, bebaskan kamera (Bisa di-zoom out untuk melihat animasi)
		player.CameraMode = Enum.CameraMode.Classic;
		player.CameraMinZoomDistance = 5;
		player.CameraMaxZoomDistance = 50;
		return;
	}

	const teamName = player.Team ? player.Team.Name : "Arwah";

	if (teamName === "Jurig") {
		// Jurig dipaksa menggunakan sudut pandang orang pertama (First-Person)
		player.CameraMode = Enum.CameraMode.LockFirstPerson;
		player.CameraMinZoomDistance = 0.5;
// ... existing code ...
	} else {
		// Arwah / saat di Lobby bebas zoom
		player.CameraMode = Enum.CameraMode.Classic;
		player.CameraMinZoomDistance = 10;
		player.CameraMaxZoomDistance = 50;
	}
}

// Deteksi saat tim atau attribute kamera berubah
player.GetPropertyChangedSignal("Team").Connect(UpdateCamera);
player.GetAttributeChangedSignal("DevFreeCam").Connect(UpdateCamera);

// Panggil satu kali saat skrip pertama kali berjalan
UpdateCamera();