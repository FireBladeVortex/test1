// 팝업 관련 요소 (추가)
const popup = document.getElementById("popup")
const popup_txt = document.getElementById("popup_txt")
const popup_close = document.getElementById("popup_close")

// ! 클릭 시 팝업 표시 (추가)
document.getElementById("alert_btn").addEventListener("click", async () =>
{
	popup.style.background = "#ffffff"
	popup.style.color = "#000000"
	popup_txt.textContent = await fetch("anne/anne.txt").then(res => res.text()) 
	popup.classList.add("active")
})

// ? 클릭 시 팝업 표시 (추가)
document.getElementById("help_btn").addEventListener("click", async () =>
{
	popup.style.background = "#000000"
	popup.style.color = "var(--highlight)"
	popup_txt.textContent = await fetch("anne/ctrl.txt").then(res => res.text()) 
	popup.classList.add("active")
})

// x 클릭 시 팝업 제거 (추가)
popup_close.addEventListener("click", () =>
{
	popup.classList.remove("active")
})
