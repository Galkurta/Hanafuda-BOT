import figlet from "figlet";
import { ColorTheme } from "./colors.js";

const colors = new ColorTheme();

function displayBanner() {
  const banner = figlet.textSync("Hanafuda BOT", {
    font: "ANSI Shadow",
    horizontalLayout: "default",
    verticalLayout: "default",
    width: 100,
  });

  console.log(colors.style(banner, "header"));
  console.log(
    colors.style("===============================================", "border")
  );
  console.log(colors.style("GitHub  : https://github.com/Galkurta", "link"));
  console.log(colors.style("Telegram: https://t.me/galkurtarchive", "link"));
  console.log(
    colors.style("===============================================\n", "border")
  );
}

export default displayBanner;
