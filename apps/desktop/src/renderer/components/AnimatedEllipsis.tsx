import React, { useState, useEffect } from "react";

/**
 * A component that cycles through ., .., ... with an animation effect
 */
const AnimatedEllipsis = () => {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return ".";
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return <span>{dots}</span>;
};

export default AnimatedEllipsis;
