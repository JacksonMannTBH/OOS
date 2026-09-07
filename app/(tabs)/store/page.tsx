import Image from "next/image";
import { SettingsBackLink } from "@/components/SettingsBackLink";
import styles from "./store.module.css";

export const metadata = {
  title: "Concept Pieces",
  description: "Early Out of Sight apparel concepts.",
};

const CONCEPTS = [
  {
    image: "/images/store/concept-hoodie.png",
    alt: "Back of a washed-black hoodie with a warped stripe panel and the Out of Sight eye mark",
  },
  {
    image: "/images/store/concept-cap.png",
    alt: "Washed-black cap with an embroidered Out of Sight eye crossed by a white line",
  },
] as const;

export default function StorePage() {
  return (
    <main className={styles.page}>
      <SettingsBackLink />

      <div className={styles.banner} role="status">
        Coming soon
      </div>

      <section className={styles.grid} aria-label="Apparel concepts">
        {CONCEPTS.map((concept, index) => (
          <div key={concept.image} className={styles.imageFrame}>
            <Image
              src={concept.image}
              alt={concept.alt}
              fill
              priority={index === 0}
              sizes="(min-width: 760px) 390px, calc(100vw - 36px)"
              className={styles.image}
            />
          </div>
        ))}
      </section>
    </main>
  );
}
